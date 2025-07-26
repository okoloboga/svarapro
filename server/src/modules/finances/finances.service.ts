import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Deposit } from '../../entities/deposits.entity';
import { User } from '../../entities/user.entity';
import { ApiService } from '../../services/api.service';
import { v4 as uuidv4 } from 'uuid';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class FinancesService {
  private readonly logger = new Logger(FinancesService.name);
  private readonly TON_TO_USDT_RATE = 3; // Фиксированный курс: 3 USDT = 1 TON

  constructor(
    @InjectRepository(Deposit)
    private depositRepository: Repository<Deposit>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private apiService: ApiService,
    @InjectQueue('callback-queue') private callbackQueue: Queue,
  ) {}

  async initDeposit(userId: string, currency: string): Promise<Deposit> {
    const clientTransactionId = uuidv4();
    const { address, trackerId } = await this.apiService.createDepositAddress(currency, clientTransactionId);

    const deposit = this.depositRepository.create({
      user: { id: userId } as User,
      currency,
      address,
      tracker_id: trackerId,
      status: 'pending',
    });

    return await this.depositRepository.save(deposit);
  }

  async processCallback(trackerId: string): Promise<void> {
    const transactionData = await this.apiService.getTransactionStatus(trackerId);
    const deposit = await this.depositRepository.findOne({ where: { tracker_id: trackerId } });

    if (deposit) {
      if (transactionData.status === 'complete' && transactionData.amount) {
        deposit.status = 'complete';
        deposit.amount = transactionData.amount;
        deposit.transaction_hash = transactionData.transaction_hash;

        const user = await this.userRepository.findOne({ where: { id: deposit.user.id } });
        if (user) {
          user.balance += transactionData.amount;
          user.totalDeposit += transactionData.amount;
          await this.userRepository.save(user);
          
          // Конвертация в USDT для проверки условия
          const amountInUsdt = this.convertTonToUsdt(deposit, transactionData.amount);


          // Реферальная логика
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

              const bonusAmount = ((amountInUsdt - 100) * refBonus) / 100;
              if (bonusAmount > 0) {
                referrer.refBalance += bonusAmount;
                await this.userRepository.save(referrer);

                if (referrer.refBalance >= 10) {
                  referrer.balance += referrer.refBalance;
                  this.logger.log(`Обнуление refBalance для ${referrer.id}: добавлено ${referrer.refBalance} к balance`);
                  referrer.refBalance = 0;
                  await this.userRepository.save(referrer);
                }
              }
            }
          }
        }
      } else if (transactionData.status === 'failed') {
        deposit.status = 'failed';
      }
      await this.depositRepository.save(deposit);
    }
  }

  async addToCallbackQueue(trackerId: string): Promise<void> {
    await this.callbackQueue.add('process-callback', { trackerId }, { attempts: 3, backoff: 5000 });
  }

  // Метод для конвертации TON в USDT (заглушка, пока фиксированный курс)
  private convertTonToUsdt(deposit: Deposit, amount: number): number {
    if (deposit.currency === 'TON') {
      return amount * this.TON_TO_USDT_RATE;
    }
    return amount; // Для USDTTON возвращаем как есть
  }
}
