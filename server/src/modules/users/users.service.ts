import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { ProfileDto } from './dto/profile.dto';
import { Logger } from '@nestjs/common';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
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
    const user = await this.usersRepository.findOne({ where: { telegramId }, relations: ['referrals'] });
    if (!user) throw new NotFoundException('User not found');

    if (depositAmount > 0) {
      user.totalDeposit += depositAmount;
      await this.usersRepository.save(user);
    }

    const referralCount = user.referrals.length;
    if (referralCount > 0) {
      user.refBonus = this.calculateRefBonus(referralCount);
    }
    await this.usersRepository.save(user);
  }

  // Метод для получения списка рефералов
  async getReferrals(user: User): Promise<{ username: string | null }[]> {
    if (!user.referrals) {
      return [];
    }
    return user.referrals.map((referral) => ({ username: referral.username }));
  }

  // Новый метод для получения всех реферальных данных
  async getReferralData(telegramId: string) {
    this.logger.log(`Fetching referral data for Telegram ID: ${telegramId}`);
    const user = await this.usersRepository.findOne({ where: { telegramId }, relations: ['referrals'] });
    if (!user) throw new NotFoundException('User not found');

    const referralCount = user.referrals.length;
    const referrals = await this.getReferrals(user);
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
