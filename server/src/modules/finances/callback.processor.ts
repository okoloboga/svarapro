import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { FinancesService } from './finances.service';
import { Logger } from '@nestjs/common';

@Processor('callback-queue')
export class CallbackProcessor {
  private readonly logger = new Logger(CallbackProcessor.name);

  constructor(private readonly financesService: FinancesService) {
    this.logger.log('CallbackProcessor initialized');
  }

  @Process('process-callback')
  async handleCallback(job: Job<{ trackerId: string; clientTransactionId?: string }>) {
    this.logger.debug(`Processing job ${job.id} for trackerId: ${job.data.trackerId}, clientTransactionId: ${job.data.clientTransactionId}`);
    try {
      await this.financesService.processCallback(job.data.trackerId, job.data.clientTransactionId);
      this.logger.log(`Successfully processed callback for trackerId: ${job.data.trackerId}, jobId: ${job.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to process callback for trackerId: ${job.data.trackerId}, jobId: ${job.id}`,
        error.stack,
        { error: error.message, details: error }
      );
      throw error; // Позволяем Bull повторить попытку
    }
  }
}
