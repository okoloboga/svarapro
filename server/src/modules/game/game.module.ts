import { Module } from '@nestjs/common';
import { GameService } from './services/game.service';
import { CardService } from './services/card.service';
import { PlayerService } from './services/player.service';
import { BettingService } from './services/betting.service';
import { GameStateService } from './services/game-state.service';
import { GameGateway } from './game.gateway';
import { RedisService } from '../../services/redis.service';

@Module({
  providers: [
    GameService,
    CardService,
    PlayerService,
    BettingService,
    GameStateService,
    GameGateway,
    RedisService,
  ],
  exports: [GameService],
})
export class GameModule {}
