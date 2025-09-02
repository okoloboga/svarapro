import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { RedisService } from '../../services/redis.service';

@Module({
  controllers: [HealthController],
  providers: [HealthService, RedisService],
  exports: [HealthService],
})
export class HealthModule {} 