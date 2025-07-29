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
  ): Promise<Transaction> {
    const clientTransactionId = uuidv4();
    const { address, trackerId } =
      type === 'deposit'
        ? await this.apiService.createDepositAddress(currency, clientTransactionId)
        : await this.apiService.createWithdrawAddress(currency, clientTransactionId);

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (type === 'withdraw') {
      if (!amount) {
        throw new BadRequestException('Amount is required for withdraw');
      }
      if (user.balance < amount) {
        throw new BadRequestException('Insufficient balance');
      }
      user.balance -= amount;
      await this.userRepository.save(user);
    }

    const transaction = this.transactionRepository.create({
      user: { id: userId } as User,
      type,
      currency,
      amount: amount || 0, // Для депозитов amount заполняется в processCallback
      address,
      tracker_id: trackerId,
      status: 'pending',
    });

    return await this.transactionRepository.save(transaction);
  }

  async processCallback(trackerId: string): Promise<void> {
    const transactionData = await this.apiService.getTransactionStatus(trackerId);
    const transaction = await this.transactionRepository.findOne({
      where: { tracker_id: trackerId },
    });

    if (transaction) {
      if (transactionData.status === 'complete' && transactionData.amount) {
        transaction.status = 'complete';
        transaction.amount = transactionData.amount;
        transaction.transaction_hash = transactionData.transaction_hash;

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

                const bonusAmount = ((this.convertTonToUsdt(transaction, transactionData.amount) - 100) * refBonus) / 100;
                if (bonusAmount > 0) {
                  referrer.refBalance += bonusAmount;
                  await this.userRepository.save(referrer);

                  if (referrer.refBalance >= 10) {
                    referrer.balance += referrer.refBalance;
                    this.logger.log(
                      `Обнуление refBalance для ${referrer.id}: добавлено ${referrer.refBalance} к balance`,
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
          }
        }
      }
      await this.transactionRepository.save(transaction);
    }
  }

  async getTransactionHistory(userId: string): Promise<Transaction[]> {
    return this.transactionRepository.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
    });
  }

  async addToCallbackQueue(trackerId: string): Promise<void> {
    await this.callbackQueue.add(
      'process-callback',
      { trackerId },
      { attempts: 3, backoff: 5000 },
    );
  }

  private convertTonToUsdt(transaction: Transaction, amount: number): number {
    if (transaction.currency === 'TON') {
      return amount * this.TON_TO_USDT_RATE;
    }
    return amount;
  }
}
