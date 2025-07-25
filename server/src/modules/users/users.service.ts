import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { ProfileDto } from './dto/profile.dto';
import { Referral } from '../../entities/referrals.entity';
import { Logger } from '@nestjs/common';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Referral)
    private referralRepository: Repository<Referral>,
  ) {}

  private readonly logger = new Logger(UsersService.name);

  async getProfile(telegramId: string): Promise<ProfileDto> {
    this.logger.log(`Fetching profile for Telegram ID: ${telegramId}`);
    const user = await this.usersRepository.findOne({
      where: { telegramId },
      select: ['id', 'telegramId', 'username', 'avatar', 'balance'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      telegramId: user.telegramId,
      username: user.username,
      avatar: user.avatar,
      balance: user.balance,
    };
  }

  // Заглушка для обновления реферальных данных
  async updateReferralData(telegramId: string, depositAmount: number = 0): Promise<void> {
    this.logger.log(`Updating referral data for Telegram ID: ${telegramId}`);
    const user = await this.usersRepository.findOne({ where: { telegramId } });
    if (!user) throw new NotFoundException('User not found');

    if (depositAmount > 0) {
      user.totalDeposit += depositAmount;
      await this.usersRepository.save(user);
    }

    const referralCount = await this.referralRepository.count({ where: { referrer: { telegramId: user.telegramId } } });
    if (referralCount > 0) {
      user.refBonus = this.calculateRefBonus(referralCount);
    }
    await this.usersRepository.save(user);
  }

  // Метод для получения списка рефералов
  async getReferrals(telegramId: string): Promise<{ username: string | null }[]> {
    this.logger.log(`Fetching referrals for Telegram ID: ${telegramId}`);
    const referrals = await this.referralRepository.find({
      where: { referrer: { telegramId } },
      relations: ['referral'],
      select: ['id'],
    });

    const referralUsers = await this.usersRepository.find({
      where: referrals.map((ref) => ({ id: ref.referral.id })),
      select: ['username'],
    });

    return referralUsers.map((user) => ({ username: user.username }));
  }

  // Новый метод для получения всех реферальных данных
  async getReferralData(telegramId: string) {
    this.logger.log(`Fetching referral data for Telegram ID: ${telegramId}`);
    const user = await this.usersRepository.findOne({ where: { telegramId } });
    if (!user) throw new NotFoundException('User not found');

    const referralCount = await this.referralRepository.count({ where: { referrer: { telegramId } } });
    const referrals = await this.getReferrals(telegramId);
    const refBonus = this.calculateRefBonus(referralCount);
    const refBalance = user.refBalance;

    return {
      referralLink: `https://t.me/svara_pro_bot?start=${encodeURIComponent(telegramId)}`,
      refBalance: refBalance.toString(),
      refBonus: refBonus.toString(),
      referralCount,
      referrals,
    };
  }

  // Вспомогательный метод для расчёта бонуса
  private calculateRefBonus(referralCount: number): number {
    if (referralCount >= 101) return 10.00;
    if (referralCount >= 31) return 8.00;
    if (referralCount >= 11) return 5.00;
    if (referralCount >= 1) return 3.00;
    return 0.00;
  }
}
