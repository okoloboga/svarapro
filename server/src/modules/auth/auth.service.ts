import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { TelegramUser } from '../../types/telegram';
import * as crypto from 'crypto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const { initData, startPayload } = loginDto;
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not configured');
    }

    // Временное отключение валидации хэша для отладки
    console.log('Skipping hash validation for debug, raw initData:', initData);
    const params = new URLSearchParams(decodeURIComponent(initData));
    const userParam = params.get('user');
    const referredBy = startPayload;
    if (!userParam)
      throw new UnauthorizedException('Missing user data in initData');

    const validated = { user: JSON.parse(userParam) as TelegramUser };

    const { user: tgUser } = validated;
    let user = await this.usersRepository.findOne({
      where: { telegramId: tgUser.id.toString() },
    });

    if (!user) {
      let referrer: User | null = null;
      if (referredBy) {
        referrer = await this.usersRepository.findOne({
          where: { telegramId: referredBy },
        });
        if (!referrer) {
          throw new UnauthorizedException('Invalid referrer');
        }
      }

      user = this.usersRepository.create({
        telegramId: tgUser.id.toString(),
        username: tgUser.username,
        avatar: tgUser.photo_url ? tgUser.photo_url : null,
        balance: 0,
        refBalance: 0,
        refBonus: 0,
        totalDeposit: 0,
        referrer: referrer, // Устанавливаем реферера
      });
      await this.usersRepository.save(user);
    } else {
      user.username = tgUser.username ?? null;
      user.avatar = tgUser.photo_url ? tgUser.photo_url : null;
      await this.usersRepository.save(user);
    }

    return {
      accessToken: this.jwtService.sign({
        sub: user.id,
        telegramId: user.telegramId,
      }),
    };
  }

  // Метод валидации оставляем для будущего использования
  private validateInitData(initData: string): { user: TelegramUser } | null {
    const params = new URLSearchParams(decodeURIComponent(initData));
    const hash = params.get('hash');
    if (!hash) return null;

    const dataToCheck: string[] = [];
    const sortedParams = Array.from(params.entries())
      .filter(([key]) => key !== 'hash' && key !== 'signature')
      .sort(([key1], [key2]) => key1.localeCompare(key2));

    for (const [key, val] of sortedParams) {
      dataToCheck.push(`${key}=${val}`);
    }

    const secret = crypto
      .createHmac('sha256', 'WebAppData')
      .update(process.env.BOT_TOKEN!)
      .digest();

    const computedHash = crypto
      .createHmac('sha256', secret)
      .update(dataToCheck.join('\n'))
      .digest('hex');

    console.log('Computed hash:', computedHash);
    console.log('Received hash:', hash);
    console.log('Data checked:', dataToCheck);

    if (hash !== computedHash) {
      console.log('Hash mismatch:', {
        dataToCheck,
        computedHash,
        receivedHash: hash,
      });
      return null;
    }

    return { user: JSON.parse(params.get('user')!) as TelegramUser };
  }
}
