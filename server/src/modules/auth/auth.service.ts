import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { TelegramUser } from '../../types/telegram';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async login(initData: string) {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not configured');
    }

    let validated: { user: TelegramUser } | null = this.validateInitData(initData);
    if (!validated) {
      // Временный обход для мока в DEV
      if (process.env.NODE_ENV === 'development' && initData.includes('mock-signature')) {
        console.log('Development mode: Bypassing Telegram auth validation for mock data');
        const params = new URLSearchParams(initData);
        validated = { user: JSON.parse(params.get('user')!) };
      } else {
        throw new UnauthorizedException('Invalid Telegram auth data');
      }
    }

    const { user: tgUser } = validated;
    let user = await this.usersRepository.findOne({ 
      where: { telegramId: tgUser.id.toString() } 
    });

    if (!user) {
      user = this.usersRepository.create({
        telegramId: tgUser.id.toString(),
        username: tgUser.username,
        avatar: tgUser.photo_url,
        balance: 0
      });
      await this.usersRepository.save(user);
    } else {
      user.username = tgUser.username ?? null;
      user.avatar = tgUser.photo_url ?? null;
      await this.usersRepository.save(user);
    }

    return {
      accessToken: this.jwtService.sign({
        sub: user.id,
        telegramId: user.telegramId
      })
    };
  }

  private validateInitData(initData: string): { user: TelegramUser } | null {
    const params = new URLSearchParams(decodeURIComponent(initData)); // Декодируем URL
    const hash = params.get('hash');
    if (!hash) throw new UnauthorizedException('Missing hash in initData');

    const dataToCheck: string[] = [];
    const sortedParams = Array.from(params.entries())
      .filter(([key]) => key !== 'hash')
      .sort(([key1], [key2]) => key1.localeCompare(key2));

    for (const [key, val] of sortedParams) {
      dataToCheck.push(`${key}=${val}`);
    }

    const secret = crypto.createHmac('sha256', 'WebAppData')
      .update(process.env.BOT_TOKEN!)
      .digest();

    const computedHash = crypto.createHmac('sha256', secret)
      .update(dataToCheck.join('\n'))
      .digest('hex');

    console.log('Computed hash:', computedHash); // Для отладки
    console.log('Received hash:', hash); // Для отладки

    if (hash !== computedHash) {
      console.log('Hash mismatch:', { dataToCheck, computedHash, receivedHash: hash });
      return null;
    }

    return { user: JSON.parse(params.get('user')!) };
  }
}
