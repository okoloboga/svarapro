import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../services/redis.service';
import {
  GameState,
  GameActionResult,
  GameAction,
} from '../../../types/game';
import { PlayerService } from './player.service';
import { TURN_DURATION_SECONDS } from '../../../constants/game.constants';

@Injectable()
export class GameTimerService {
  private readonly logger = new Logger(GameTimerService.name);
  private turnTimers = new Map<string, NodeJS.Timeout>(); // Простое хранение таймеров

  constructor(
    private readonly redisService: RedisService,
    private readonly playerService: PlayerService,
  ) {}

  // Упрощенное управление таймерами
  startTurnTimer(roomId: string, playerId: string): void {
    console.log(`[TIMER_START_DEBUG] Starting turn timer for room ${roomId}, player ${playerId}`);
    console.log(`[TIMER_START_DEBUG] Stack trace:`, new Error().stack?.split('\n').slice(1, 4).join('\n'));
    
    this.clearTurnTimer(roomId); // Всегда очищаем предыдущий
    
    const timer = setTimeout(async () => {
      console.log(`[TIMER_TIMEOUT_DEBUG] Timer timeout for room ${roomId}, player ${playerId}`);
      await this.handleAutoFold(roomId, playerId);
      this.turnTimers.delete(roomId);
    }, TURN_DURATION_SECONDS * 1000);
    
    this.turnTimers.set(roomId, timer);
  }

  clearTurnTimer(roomId: string): void {
    const timer = this.turnTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.turnTimers.delete(roomId);
    }
  }

  // Обработка автоматического fold по таймеру
  async handleAutoFold(
    roomId: string,
    telegramId: string,
  ): Promise<GameActionResult> {
    console.log(`[AUTO_FOLD_TIMER_DEBUG] Starting handleAutoFold for room ${roomId}, player ${telegramId}`);
    console.log(`[AUTO_FOLD_TIMER_DEBUG] Stack trace:`, new Error().stack?.split('\n').slice(1, 4).join('\n'));
    let gameState: GameState | null;
    try {
      gameState = await this.redisService.getGameState(roomId);
      if (!gameState) {
        return { success: false, error: 'Игра не найдена' };
      }
    } catch (error) {
      console.error(`[handleAutoFold] Redis error for room ${roomId}:`, error);
      return { success: false, error: 'Ошибка подключения к серверу' };
    }

    const playerIndex = gameState.players.findIndex((p) => p.id === telegramId);
    const player = gameState.players[playerIndex];

    if (!player) {
      return { success: false, error: 'Игрок не найден в этой игре' };
    }

    // Проверяем, что это действительно ход этого игрока
    console.log(`[AUTO_FOLD_DEBUG] Auto fold for player: ${telegramId}, playerIndex: ${playerIndex}, currentPlayerIndex: ${gameState.currentPlayerIndex}`);
    if (gameState.currentPlayerIndex !== playerIndex) {
      console.log(`[AUTO_FOLD_DEBUG] Not player's turn, silently skipping auto fold`);
      return { success: true }; // Молча игнорируем, не возвращаем ошибку
    }

    // Увеличиваем счетчик бездействия
    const newInactivityCount = (player.inactivityCount || 0) + 1;

    // Проверяем, нужно ли исключить игрока (3 раза подряд)
    if (newInactivityCount >= 3) {
      // Исключаем игрока из комнаты
      // Возвращаем флаг для исключения игрока
      return { success: true, shouldKickPlayer: true, player };
    }

    // Выполняем fold с обновленным счетчиком
    gameState.players[playerIndex] = this.playerService.updatePlayerStatus(
      player,
      {
        hasFolded: true,
        lastAction: 'fold',
        hasLookedAndMustAct: false,
        inactivityCount: newInactivityCount,
      },
    );

    const foldAction: GameAction = {
      type: 'fold',
      telegramId: player.id,
      timestamp: Date.now(),
      message: `Игрок ${player.username} сбросил карты (автоматически, ${newInactivityCount}/3)`,
    };
    gameState.log.push(foldAction);

    // Возвращаем обновленное состояние для обработки fold
    return { success: true, gameState, shouldProcessFold: true };
  }

  // Очистка всех таймеров при завершении игры
  clearAllTimers(): void {
    for (const [roomId, timer] of this.turnTimers.entries()) {
      clearTimeout(timer);
    }
    this.turnTimers.clear();
  }

  // Получение информации о текущем таймере
  hasActiveTimer(roomId: string): boolean {
    return this.turnTimers.has(roomId);
  }
}
