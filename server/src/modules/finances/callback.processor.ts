import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { FinancesService } from './finances.service';
import { Logger } from '@nestjs/common';

@Processor('callback-queue')
export class CallbackProcessor {
  private readonly logger = new Logger(CallbackProcessor.name);

  constructor(private readonly financesService: FinancesService) {}

  @Process('process-callback')
  async handleCallback(job: Job<{ trackerId: string }>) {
    this.logger.debug(`Processing job for trackerId: ${job.data.trackerId}`);
    try {
      await this.financesService.processCallback(job.data.trackerId);
      this.logger.log(`Successfully processed callback for trackerId: ${job.data.trackerId}`);
    } catch (error) {
      this.logger.error(`Failed to process callback for trackerId: ${job.data.trackerId}`, error.stack);
      throw error;
    }
  }
}
