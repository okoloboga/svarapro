import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinancesService } from './finances.service';
import { FinancesController } from './finances.controller';
import { Deposit } from '../../entities/deposits.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Deposit])],
  controllers: [FinancesController],
  providers: [FinancesService],
  exports: [FinancesService],
})
export class FinancesModule {}
