import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinancesService } from './finances.service';
import { FinancesController } from './finances.controller';
import { Transaction } from '../../entities/transactions.entity';
import { User } from '../../entities/user.entity';
import { ApiService } from '../../services/api.service';
import { BullModule } from '@nestjs/bull';
import { CallbackProcessor } from './callback.processor'; // Добавлено

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, User]),
    BullModule.registerQueue({
      name: 'callback-queue',
    }),
  ],
  controllers: [FinancesController],
  providers: [FinancesService, ApiService, CallbackProcessor], // Добавлено CallbackProcessor
  exports: [FinancesService],
})
export class FinancesModule {}
