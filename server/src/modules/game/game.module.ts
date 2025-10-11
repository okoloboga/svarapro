import { Module } from '@nestjs/common';
import { GameService } from './services/game.service';
import { CardService } from './services/card.service';
import { PlayerService } from './services/player.service';
import { BettingService } from './services/betting.service';
import { GameStateService } from './services/game-state.service';
import { GameRoomService } from './services/game-room.service';
import { GameLifecycleService } from './services/game-lifecycle.service';
import { GameActionService } from './services/game-action.service';
import { GameTimerService } from './services/game-timer.service';
import { SvaraService } from './services/svara.service';
import { GameEndService } from './services/game-end.service';
import { GameSpecialActionsService } from './services/game-special-actions.service';
import { GameGateway } from './game.gateway';
import { RedisService } from '../../services/redis.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  providers: [
    // Основные сервисы
    GameService,
    GameRoomService,
    GameLifecycleService,
    GameActionService,
    GameTimerService,
    SvaraService,
    GameEndService,
    GameSpecialActionsService,
    
    // Вспомогательные сервисы
    CardService,
    PlayerService,
    BettingService,
    GameStateService,
    
    // Инфраструктурные сервисы
    GameGateway,
    RedisService,
  ],
  exports: [GameService, GameStateService],
})
export class GameModule {}
