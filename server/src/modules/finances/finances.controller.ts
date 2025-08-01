import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { FinancesService } from './finances.service';

@Controller('finances')
export class FinancesController {
  constructor(private financesService: FinancesService) {}

  @Post('transaction')
  async createTransaction(@Body() body: {
    telegramId: string;
    currency: string;
    type: 'deposit' | 'withdraw';
    amount?: number;
    receiver?: string;
    destTag?: string;
  }) {
    const transaction = await this.financesService.initTransaction(
      body.telegramId,
      body.currency,
      body.type,
      body.amount,
      body.receiver,
      body.destTag,
    );
    // Преобразуем Transaction в нужный формат для клиента
    return {
      address: transaction.address,
      trackerId: transaction.tracker_id,
    };
  }

  @Post('callback')
  async handleCallback(@Body() body: { tracker_id: string }) {
    await this.financesService.addToCallbackQueue(body.tracker_id);
    return { status: 'accepted' };
  }

  @Get('history/:userId')
  async getTransactionHistory(@Param('userId') userId: string) {
    const transactions = await this.financesService.getTransactionHistory(userId);
    return transactions.map((t) => ({
      type: t.type,
      currency: t.currency,
      amount: t.amount,
      status: t.status === 'failed' ? 'canceled' : t.status === 'complete' ? 'confirmed' : t.status,
      tracker_id: t.tracker_id,
      createdAt: t.createdAt.toISOString(),
    }));
  }
}
