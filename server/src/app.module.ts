import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { FinancesModule } from './modules/finances/finances.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { BullModule } from '@nestjs/bull';
import * as Joi from 'joi';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        POSTGRES_HOST: Joi.string().required(),
        POSTGRES_PORT: Joi.number().port().required(),
        POSTGRES_USER: Joi.string().required(),
        POSTGRES_PASSWORD: Joi.string().required(),
        POSTGRES_DB: Joi.string().required(),
        NODE_ENV: Joi.string()
          .valid('development', 'production')
          .default('development'),
        REDIS_HOST: Joi.string().required(),
        REDIS_PORT: Joi.number().required(),
        BOT_TOKEN: Joi.string().required(),
      }).unknown(true),
    }),
    TypeOrmModule.forRootAsync({
      useFactory: (config: ConfigService) => {
        const nodeEnv = config.get<string>('NODE_ENV');
        console.log('Current NODE_ENV:', nodeEnv);
        console.log('Config loaded:', {
          host: config.get<string>('POSTGRES_HOST'),
          port: config.get<number>('POSTGRES_PORT'),
          env: nodeEnv,
        });
        return {
          type: 'postgres',
          host: config.get<string>('POSTGRES_HOST'),
          port: config.get<number>('POSTGRES_PORT'),
          username: config.get<string>('POSTGRES_USER'),
          password: config.get<string>('POSTGRES_PASSWORD'),
          database: config.get<string>('POSTGRES_DB'),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: true, // Временно включено для отладки
          logging: false,
          ssl: false,
        };
      },
      inject: [ConfigService],
    }),
    BullModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get<string>('REDIS_HOST'),
          port: config.get<number>('REDIS_PORT'),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'callback-queue',
    }),
    AuthModule,
    UsersModule,
    FinancesModule,
    RoomsModule,
  ],
})
export class AppModule {}
