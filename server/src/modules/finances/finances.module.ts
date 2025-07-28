import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinancesService } from './finances.service';
import { FinancesController } from './finances.controller';
import { Deposit } from '../../entities/deposits.entity';
import { User } from '../../entities/user.entity';
import { ApiService } from '../../services/api.service';
import { BullModule } from '@nestjs/bull';

@Module({
  imports: [
    TypeOrmModule.forFeature([Deposit, User]),
    BullModule.registerQueue({
      name: 'callback-queue',
    }),
  ],
  controllers: [FinancesController],
  providers: [FinancesService, ApiService],
  exports: [FinancesService],
})
export class FinancesModule {}
