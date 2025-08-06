import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { FinancesController } from './finances.controller';
import { FinancesService } from './finances.service';
import { TransactionGateway } from './transactions.gateway';
import { CallbackProcessor } from './callback.processor'; // Добавляем импорт
import { Transaction } from '../../entities/transactions.entity';
import { User } from '../../entities/user.entity';
import { ApiService } from '../../services/api.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, User]),
    BullModule.registerQueue({
      name: 'callback-queue',
    }),
  ],
  controllers: [FinancesController],
  providers: [
    FinancesService,
    ApiService,
    TransactionGateway,
    CallbackProcessor,
  ], // Добавляем CallbackProcessor
})
export class FinancesModule {}
