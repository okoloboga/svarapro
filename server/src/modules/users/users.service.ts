import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { ProfileDto } from './dto/profile.dto';
import { Address } from 'ton-core';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async getProfile(telegramId: string): Promise<ProfileDto> {
    const user = await this.usersRepository.findOne({
      where: { telegramId },
      select: [
        'id',
        'telegramId',
        'username',
        'avatar',
        'balance',
        'walletAddress',
      ],
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
      walletAddress: user.walletAddress,
    };
  }

  async addWalletAddress(
    telegramId: string,
    walletAddress: string,
  ): Promise<void> {
    try {
      Address.parse(walletAddress);
    } catch {
      throw new BadRequestException('Invalid TON address format');
    }

    const existingUser = await this.usersRepository.findOne({
      where: { walletAddress },
    });
    if (existingUser) {
      throw new ConflictException('Wallet address already in use');
    }

    const user = await this.usersRepository.findOne({ where: { telegramId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.walletAddress = walletAddress;
    await this.usersRepository.save(user);
  }

  // Заглушка для обновления реферальных данных
  async updateReferralData(
    telegramId: string,
    depositAmount: number = 0,
  ): Promise<void> {
    const user = await this.usersRepository.findOne({
      where: { telegramId },
      relations: ['referrals'],
    });
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

  async getReferrals(
    telegramId: string,
  ): Promise<{ username: string | null }[]> {
    const user = await this.usersRepository.findOne({
      where: { telegramId },
      relations: ['referrals'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.referrals) {
      return [];
    }
    return user.referrals.map((referral) => ({ username: referral.username }));
  }

  // Новый метод для получения всех реферальных данных
  async getReferralData(telegramId: string) {
    const user = await this.usersRepository.findOne({
      where: { telegramId },
      relations: ['referrals'],
    });
    if (!user) throw new NotFoundException('User not found');

    const referralCount = user.referrals.length;
    const referrals = await this.getReferrals(telegramId);
    const refBonus = this.calculateRefBonus(referralCount);
    const refBalance = user.refBalance;

    return {
      referralLink: `https://t.me/Svaraprobot?start=${encodeURIComponent(telegramId)}`,
      refBalance: refBalance.toString(),
      refBonus: refBonus.toString(),
      referralCount,
      referrals,
    };
  }

  // Вспомогательный метод для расчёта бонуса
  private calculateRefBonus(referralCount: number): number {
    if (referralCount >= 101) return 10.0;
    if (referralCount >= 31) return 8.0;
    if (referralCount >= 11) return 5.0;
    if (referralCount >= 1) return 3.0;
    return 0.0;
  }
}
