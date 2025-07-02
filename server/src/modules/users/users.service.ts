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
      select: ['id', 'telegramId', 'username', 'avatar', 'balance']
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      telegramId: user.telegramId,
      username: user.username,
      avatar: user.avatar,
      balance: user.balance
    };
  }
}
