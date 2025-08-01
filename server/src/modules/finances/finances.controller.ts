import { Controller, Post, Body, Get, Param, BadRequestException } from '@nestjs/common';
import { FinancesService } from './finances.service';
import { Logger } from '@nestjs/common';

@Controller('finances')
export class FinancesController {
  private readonly logger = new Logger(FinancesController.name);
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
    return {
      address: transaction.address,
      tracker_id: transaction.tracker_id,
    };
  }

  @Post('callback')
  async handleCallback(@Body() body: { tracker_id: string; client_transaction_id?: string }) {
    this.logger.debug(`Callback received: ${JSON.stringify(body)}`);
    if (!body.tracker_id) {
      this.logger.error('tracker_id is required in callback');
      throw new BadRequestException('tracker_id is required');
    }
    await this.financesService.addToCallbackQueue(body.tracker_id, body.client_transaction_id);
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
