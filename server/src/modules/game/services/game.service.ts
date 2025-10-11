import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../services/redis.service';
import {
  GameState,
  GameActionResult,
  Room,
} from '../../../types/game';
import { UserDataDto } from '../dto/user-data.dto';
import { GameRoomService } from './game-room.service';
import { GameLifecycleService } from './game-lifecycle.service';
import { GameActionService } from './game-action.service';
import { GameTimerService } from './game-timer.service';
import { SvaraService } from './svara.service';
import { GameEndService } from './game-end.service';

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);
  
  constructor(
    private readonly redisService: RedisService,
    private readonly gameRoomService: GameRoomService,
    private readonly gameLifecycleService: GameLifecycleService,
    private readonly gameActionService: GameActionService,
    private readonly gameTimerService: GameTimerService,
    private readonly svaraService: SvaraService,
    private readonly gameEndService: GameEndService,
  ) {
    setInterval(
      () => {
        this.redisService.cleanupDeadPlayers().catch((error) => {
          console.error('Error during periodic cleanup:', error);
        });
      },
      5 * 60 * 1000,
    );
  }

  // Делегируем управление комнатами
  async getRooms(): Promise<Room[]> {
    return this.gameRoomService.getRooms();
  }

  async joinRoom(
    roomId: string,
    telegramId: string,
  ): Promise<GameActionResult> {
    return this.gameRoomService.joinRoom(roomId, telegramId);
  }

  async leaveRoom(roomId: string, telegramId: string): Promise<void> {
    await this.gameRoomService.leaveRoom(roomId, telegramId);
  }

  async sitDown(
    roomId: string,
    telegramId: string,
    position: number,
    userData: UserDataDto,
  ): Promise<GameActionResult> {
    const result = await this.gameRoomService.sitDown(roomId, telegramId, position, userData);
    
    // Проверяем, нужно ли запустить игру
    if (result.success && result.gameState) {
      const room = await this.redisService.getRoom(roomId);
      if (room && result.gameState.players.length >= 2 && room.status === 'waiting') {
        await this.startGame(roomId);
      }
    }
    
    return result;
  }

  // Делегируем управление жизненным циклом игры
  async startGame(roomId: string): Promise<void> {
    await this.gameLifecycleService.startGame(roomId);
    
    // После старта игры запускаем таймер для первого игрока
    const gameState = await this.redisService.getGameState(roomId);
    if (gameState && gameState.currentPlayerIndex !== undefined) {
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      if (currentPlayer) {
        // Проверяем, нет ли уже активного таймера
        if (this.gameTimerService.hasActiveTimer(roomId)) {
          console.log(`[TIMER_DEBUG] Timer already exists for room ${roomId} at game start, clearing before starting new one`);
          this.gameTimerService.clearTurnTimer(roomId);
        }
        console.log(`[TIMER_DEBUG] Starting initial timer for player ${currentPlayer.id} in room ${roomId}`);
        this.gameTimerService.startTurnTimer(roomId, currentPlayer.id);
      }
    }
  }

  // Делегируем обработку действий игроков
  async processAction(
    roomId: string,
    telegramId: string,
    action: string,
    amount?: number,
  ): Promise<GameActionResult> {
    console.log(`[PROCESS_ACTION_DEBUG] Starting processAction for room ${roomId}, telegramId ${telegramId}, action ${action}, amount ${amount}`);
    console.log(`[PROCESS_ACTION_DEBUG] Stack trace:`, new Error().stack?.split('\n').slice(1, 4).join('\n'));
    // Специальные действия свары
    if (action === 'join_svara') {
      return this.svaraService.joinSvara(roomId, telegramId);
    }
    if (action === 'skip_svara') {
      return this.svaraService.skipSvara(roomId, telegramId);
    }

    // Обрабатываем обычные действия
    const result = await this.gameActionService.processAction(roomId, telegramId, action, amount);
    
    // Обрабатываем специальные флаги результата
    if (result.success && result.gameState) {
      if (result.shouldEndBettingRound) {
        await this.gameEndService.endBettingRound(roomId, result.gameState);
      }
      if (result.shouldStartTimer && result.gameState.currentPlayerIndex !== undefined) {
        const currentPlayer = result.gameState.players[result.gameState.currentPlayerIndex];
        if (currentPlayer) {
          // Проверяем, нет ли уже активного таймера для этой комнаты
          if (this.gameTimerService.hasActiveTimer(roomId)) {
            console.log(`[TIMER_DEBUG] Timer already exists for room ${roomId}, clearing before starting new one`);
            this.gameTimerService.clearTurnTimer(roomId);
          }
          console.log(`[TIMER_DEBUG] Starting timer for player ${currentPlayer.id} in room ${roomId}`);
          this.gameTimerService.startTurnTimer(roomId, currentPlayer.id);
        }
      }
    }
    
    return result;
  }

  // Делегируем управление таймерами
  async handleAutoFold(
    roomId: string,
    playerId: string,
  ): Promise<GameActionResult> {
    return this.gameTimerService.handleAutoFold(roomId, playerId);
  }

  // Делегируем логику свары
  async joinSvara(roomId: string, telegramId: string): Promise<GameActionResult> {
    return this.svaraService.joinSvara(roomId, telegramId);
  }

  async skipSvara(roomId: string, telegramId: string): Promise<GameActionResult> {
    return this.svaraService.skipSvara(roomId, telegramId);
  }

  // Делегируем завершение игры
  async endGameWithWinner(roomId: string, gameState: GameState): Promise<void> {
    await this.gameEndService.endGameWithWinner(roomId, gameState);
  }

  async distributeWinnings(roomId: string): Promise<void> {
    await this.gameEndService.distributeWinnings(roomId);
  }

  // Очистка ресурсов при завершении
  async onModuleDestroy(): Promise<void> {
    this.gameTimerService.clearAllTimers();
    this.svaraService.clearAllSvaraTimers();
  }
}