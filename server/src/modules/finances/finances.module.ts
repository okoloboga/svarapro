import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinancesService } from './finances.service';
import { FinancesController } from './finances.controller';
import { Deposit } from '../../entities/deposits.entity';
import { User } from '../../entities/user.entity';
import { ApiService } from '../../services/api.service';

@Module({
  imports: [TypeOrmModule.forFeature([Deposit, User])],
  controllers: [FinancesController],
  providers: [FinancesService, ApiService],
  exports: [FinancesService],
})
export class FinancesModule {}
