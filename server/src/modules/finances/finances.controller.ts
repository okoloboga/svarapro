import { Controller, Post, Body } from '@nestjs/common';
import { FinancesService } from './finances.service';

@Controller('api/finances')
export class FinancesController {
  constructor(private financesService: FinancesService) {}

  @Post('deposit')
  async initiateDeposit(@Body() body: { userId: string; currency: string }) {
    const { userId, currency } = body;
    const deposit = await this.financesService.initDeposit(userId, currency);
    return { address: deposit.address, trackerId: deposit.tracker_id };
  }

  @Post('callback')
  async handleCallback(@Body() body: { tracker_id: string }) {
    await this.financesService.addToCallbackQueue(body.tracker_id);
    return { status: 'accepted' };
  }
}
