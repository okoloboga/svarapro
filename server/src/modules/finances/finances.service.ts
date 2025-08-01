import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../../entities/transactions.entity';
import { User } from '../../entities/user.entity';
import { ApiService } from '../../services/api.service';
import { v4 as uuidv4 } from 'uuid';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class FinancesService {
  private readonly logger = new Logger(FinancesService.name);
  private readonly TON_TO_USDT_RATE = 3;
  private readonly supportedCurrencies = ['USDTTON', 'TON']; // Обновлено: только USDTTON и TON

  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private apiService: ApiService,
    @InjectQueue('callback-queue') private callbackQueue: Queue,
  ) {}

  async initTransaction(
    userId: string,
    currency: string,
    type: 'deposit' | 'withdraw',
    amount?: number,
    receiver?: string,
    destTag?: string,
  ): Promise<Transaction> {
    this.logger.debug(`Initiating transaction: userId=${userId}, currency=${currency}, type=${type}, amount=${amount}, receiver=${receiver}, destTag=${destTag}`);

    // Валидация входных параметров
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
    } else {
      const withdrawAmount: number = amount!; // Гарантировано валидацией выше
      const withdrawReceiver: string = receiver!; // Гарантировано валидацией выше

      const withdraw = await this.apiService.createWithdrawAddress(
        currency,
        clientTransactionId,
        withdrawAmount,
        withdrawReceiver,
        destTag,
      );
      trackerId = withdraw.trackerId;
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      this.logger.error(`User not found: ${userId}`);
      throw new BadRequestException('User not found');
    }

    if (type === 'withdraw') {
      const withdrawAmount: number = amount!; // Гарантировано валидацией выше
      if (user.balance < withdrawAmount) {
        this.logger.error(`Insufficient balance for user ${userId}: balance=${user.balance}, amount=${withdrawAmount}`);
        throw new BadRequestException('Insufficient balance');
      }
      user.balance -= withdrawAmount;
      await this.userRepository.save(user);
    }

    const transaction = this.transactionRepository.create({
      user: { id: userId } as User,
      type,
      currency,
      amount: type === 'withdraw' ? amount! : 0, // Для депозитов amount заполняется в processCallback
      address,
      tracker_id: trackerId,
      status: 'pending',
    });

    this.logger.log(`Transaction initiated: ${trackerId}, type: ${type}, currency: ${currency}`);
    return await this.transactionRepository.save(transaction);
  }

  async processCallback(trackerId: string): Promise<void> {
    const transactionData = await this.apiService.getTransactionStatus(trackerId);
    const transaction = await this.transactionRepository.findOne({
      where: { tracker_id: trackerId },
      relations: ['user'],
    });

    if (!transaction) {
      this.logger.warn(`Transaction not found for trackerId: ${trackerId}`);
      return;
    }

    if (transactionData.status === 'complete' && transactionData.amount) {
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
    } else if (transactionData.status === 'failed') {
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
    }

    await this.transactionRepository.save(transaction);
    this.logger.log(`Callback processed: trackerId: ${trackerId}, status: ${transactionData.status}`);
  }

  async getTransactionHistory(userId: string): Promise<Transaction[]> {
    return this.transactionRepository.find({
      where: { user: { telegramId: userId } },
      order: { createdAt: 'DESC' },
    });
  }

  async addToCallbackQueue(trackerId: string): Promise<void> {
    await this.callbackQueue.add(
      'process-callback',
      { trackerId },
      { attempts: 3, backoff: 5000 },
    );
    this.logger.log(`Added to callback queue: trackerId: ${trackerId}`);
  }

  private convertTonToUsdt(transaction: Transaction, amount: number): number {
    if (transaction.currency === 'TON') {
      return amount * this.TON_TO_USDT_RATE;
    }
    return amount;
  }
}
