import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../../entities/transactions.entity';
import { User } from '../../entities/user.entity';
import { ApiService } from '../../services/api.service';
import { TransactionGateway } from './transactions.gateway';
import { v4 as uuidv4 } from 'uuid';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class FinancesService {
  private readonly logger = new Logger(FinancesService.name);
  private readonly TON_TO_USDT_RATE = 3;
  private readonly supportedCurrencies = ['USDTTON', 'TON'];

  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private apiService: ApiService,
    private transactionGateway: TransactionGateway,
    @InjectQueue('callback-queue') private callbackQueue: Queue,
  ) {
    this.logger.log('FinancesService initialized');
  }

  async initTransaction(
    telegramId: string,
    currency: string,
    type: 'deposit' | 'withdraw',
    amount?: number,
    receiver?: string,
    destTag?: string,
  ): Promise<Transaction> {
    this.logger.debug(`Initiating transaction: telegramId=${telegramId}, currency=${currency}, type=${type}, amount=${amount}, receiver=${receiver}, destTag=${destTag}`);

    if (!this.supportedCurrencies.includes(currency)) {
      this.logger.error(`Unsupported currency: ${currency}`);
      throw new BadRequestException(`Unsupported currency: ${currency}`);
    }
    if (type === 'withdraw') {
      if (!amount || amount <= 0) {
        this.logger.error(`Amount is required and must be greater than 0 for withdraw: ${amount}`);
        throw new BadRequestException('Amount is required and must be greater than 0 for withdraw');
      }
      if (!receiver || receiver.trim() === '') {
        this.logger.error(`Receiver address is required for withdraw: ${receiver}`);
        throw new BadRequestException('Receiver address is required for withdraw');
      }
    }

    const clientTransactionId = uuidv4();
    let address: string | undefined;
    let trackerId: string;

    if (type === 'deposit') {
      const deposit = await this.apiService.createDepositAddress(currency, clientTransactionId);
      address = deposit.address;
      trackerId = deposit.trackerId;
      if (trackerId.length > 128) {
        this.logger.error(`Tracker ID too long: ${trackerId} (length: ${trackerId.length})`);
        throw new BadRequestException('Tracker ID exceeds maximum length of 128 characters');
      }
    } else {
      const withdrawAmount: number = amount!;
      const withdrawReceiver: string = receiver!;
      const withdraw = await this.apiService.createWithdrawAddress(
        currency,
        clientTransactionId,
        withdrawAmount,
        withdrawReceiver,
        destTag,
      );
      trackerId = withdraw.trackerId;
      if (trackerId.length > 128) {
        this.logger.error(`Tracker ID too long: ${trackerId} (length: ${trackerId.length})`);
        throw new BadRequestException('Tracker ID exceeds maximum length of 128 characters');
      }
    }

    const user = await this.userRepository.findOne({ where: { telegramId } });
    if (!user) {
      this.logger.error(`User not found for telegramId: ${telegramId}`);
      throw new BadRequestException('User not found');
    }

    if (type === 'withdraw') {
      const withdrawAmount: number = amount!;
      if (user.balance < withdrawAmount) {
        this.logger.error(`Insufficient balance for user ${telegramId}: balance=${user.balance}, amount=${withdrawAmount}`);
        throw new BadRequestException('Insufficient balance');
      }
      user.balance -= withdrawAmount;
      await this.userRepository.save(user);
    }

    const transaction = this.transactionRepository.create({
      user: { id: user.id } as User,
      type,
      currency,
      amount: type === 'withdraw' ? amount! : 0,
      address,
      tracker_id: trackerId,
      client_transaction_id: clientTransactionId,
      status: 'pending',
    });

    this.logger.log(`Transaction initiated: ${trackerId}, type: ${type}, currency: ${currency}, clientTransactionId: ${clientTransactionId}`);
    return await this.transactionRepository.save(transaction);
  }

  async processCallback(trackerId: string, clientTransactionIdFromCallback?: string): Promise<void> {
    this.logger.debug(`Processing callback for trackerId: ${trackerId}, clientTransactionIdFromCallback: ${clientTransactionIdFromCallback}`);
    
    let transactionData;
    try {
      transactionData = await this.apiService.getTransactionStatus(trackerId);
      this.logger.debug(`Transaction data: ${JSON.stringify(transactionData)}`);
    } catch (error) {
      this.logger.error(`Failed to get transaction status for trackerId: ${trackerId}`, error.stack, { error: error.message });
      throw new BadRequestException(`Failed to get transaction status: ${error.message}`);
    }

    const clientTransactionId = transactionData.clientTransactionId;
    if (!clientTransactionId) {
      this.logger.error(`No clientTransactionId in transaction data for trackerId: ${trackerId}`);
      throw new BadRequestException('No clientTransactionId provided in transaction data');
    }

    const transaction = await this.transactionRepository.findOne({
      where: { client_transaction_id: clientTransactionId },
      relations: ['user'],
    });

    if (!transaction) {
      this.logger.warn(`Transaction not found for clientTransactionId: ${clientTransactionId}, trackerId: ${trackerId}`);
      return;
    }

    if (transactionData.status === 'SUCCESS' && transactionData.amount) {
      transaction.status = 'complete';
      transaction.amount = transactionData.amount;
      transaction.transaction_hash = transactionData.transactionHash;

      const user = await this.userRepository.findOne({
        where: { id: transaction.user.id },
      });
      if (user) {
        if (transaction.type === 'deposit') {
          user.balance += transactionData.amount;
          user.totalDeposit += transactionData.amount;
          await this.userRepository.save(user);

          try {
            // Отправляем уведомление через WebSocket
            this.transactionGateway.notifyTransactionConfirmed(
              user.telegramId,
              user.balance,
              transactionData.amount,
              transaction.currency,
            );
          } catch (error) {
            this.logger.error(`Failed to notify user ${user.telegramId} via WebSocket`, error.stack, { error: error.message });
          }

          if (user.referrer && transactionData.amount >= 100) {
            const referrer = await this.userRepository.findOne({
              where: { id: user.referrer.id },
              relations: ['referrals'],
            });
            if (referrer) {
              const referralCount = referrer.referrals.length;
              let refBonus = 0;
              if (referralCount >= 1 && referralCount <= 10) refBonus = 3;
              else if (referralCount >= 11 && referralCount <= 30) refBonus = 5;
              else if (referralCount >= 31 && referralCount <= 100) refBonus = 8;
              else if (referralCount > 100) refBonus = 10;

              const bonusAmount =
                ((this.convertTonToUsdt(transaction, transactionData.amount) - 100) * refBonus) / 100;
              if (bonusAmount > 0) {
                referrer.refBalance += bonusAmount;
                await this.userRepository.save(referrer);

                if (referrer.refBalance >= 10) {
                  referrer.balance += referrer.refBalance;
                  this.logger.log(
                    `RefBalance reset for ${referrer.id}: added ${referrer.refBalance} to balance`,
                  );
                  referrer.refBalance = 0;
                  await this.userRepository.save(referrer);
                }
              }
            }
          }
        }
      }
    } else if (transactionData.status === 'ERROR') {
      transaction.status = 'failed';
      if (transaction.type === 'withdraw') {
        const user = await this.userRepository.findOne({
          where: { id: transaction.user.id },
        });
        if (user) {
          user.balance += transaction.amount;
          await this.userRepository.save(user);
          this.logger.log(`Refunded ${transaction.amount} to user ${user.id} due to failed withdraw`);
        }
      }
    } else {
      this.logger.warn(`Unexpected transaction status: ${transactionData.status} for trackerId: ${trackerId}`);
    }

    await this.transactionRepository.save(transaction);
    this.logger.log(`Callback processed: trackerId: ${trackerId}, clientTransactionId: ${clientTransactionId}, status: ${transactionData.status}`);
  }

  async getTransactionHistory(telegramId: string): Promise<Transaction[]> {
    return this.transactionRepository.find({
      where: { user: { telegramId } },
      order: { createdAt: 'DESC' },
    });
  }

  async addToCallbackQueue(trackerId: string, clientTransactionId?: string): Promise<void> {
    try {
      await this.callbackQueue.add(
        'process-callback',
        { trackerId, clientTransactionId },
        { attempts: 3, backoff: 5000 },
      );
      this.logger.log(`Added to callback queue: trackerId: ${trackerId}, clientTransactionId: ${clientTransactionId}`);
    } catch (error) {
      this.logger.error(`Failed to add to callback queue for trackerId: ${trackerId}`, error.stack, { error: error.message });
      throw error;
    }
  }

  private convertTonToUsdt(transaction: Transaction, amount: number): number {
    if (transaction.currency === 'TON') {
      return amount * this.TON_TO_USDT_RATE;
    }
    return amount;
  }
}
