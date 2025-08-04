import { Module } from '@nestjs/common';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { RoomsGateway } from './rooms.gateway';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Room } from '../../entities/rooms.entity';
import { RedisService } from '../../services/redis.service';
import { TelegramService } from '../../services/telegram.service';

@Module({
  imports: [TypeOrmModule.forFeature([Room])],
  controllers: [RoomsController],
  providers: [RoomsService, RoomsGateway, RedisService, TelegramService],
})
export class RoomsModule {}
