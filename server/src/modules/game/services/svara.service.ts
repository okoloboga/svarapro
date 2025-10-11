import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../services/redis.service';
import {
  GameState,
  GameAction,
  GameActionResult,
  Player,
} from '../../../types/game';
import { GameStateService } from './game-state.service';
import { PlayerService } from './player.service';
import { TURN_DURATION_SECONDS } from '../../../constants/game.constants';

@Injectable()
export class SvaraService {
  private readonly logger = new Logger(SvaraService.name);
  private svaraTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    private readonly redisService: RedisService,
    private readonly gameStateService: GameStateService,
    private readonly playerService: PlayerService,
  ) {}

  async joinSvara(roomId: string, telegramId: string): Promise<GameActionResult> {
    const gameState = await this.redisService.getGameState(roomId);
    if (!gameState || gameState.status !== 'svara_pending') {
      return { success: false, error: 'Сейчас нельзя присоединиться к сваре' };
    }

    // Если уже участвует - возвращаем успех
    if (gameState.svaraConfirmed?.includes(telegramId) || gameState.svaraDeclined?.includes(telegramId)) {
      return { success: true, gameState };
    }

    const player = gameState.players.find(p => p.id === telegramId);
    if (!player) {
      return { success: false, error: 'Игрок не найден' };
    }

    // Упрощенная логика: добавляем в подтвержденные
    if (!gameState.svaraConfirmed) {
      gameState.svaraConfirmed = [];
    }
    gameState.svaraConfirmed.push(telegramId);

    const action: GameAction = {
      type: 'join',
      telegramId,
      timestamp: Date.now(),
      message: `Игрок ${player.username} присоединился к сваре`,
    };
    gameState.log.push(action);

    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);
    await this._checkSvaraCompletion(roomId, gameState);

    return { success: true, gameState };
  }

  async skipSvara(roomId: string, telegramId: string): Promise<GameActionResult> {
    const gameState = await this.redisService.getGameState(roomId);
    if (!gameState || gameState.status !== 'svara_pending') {
      return { success: false, error: 'Сейчас нельзя пропустить свару' };
    }

    // Если уже участвует - возвращаем успех
    if (gameState.svaraConfirmed?.includes(telegramId) || gameState.svaraDeclined?.includes(telegramId)) {
      return { success: true, gameState };
    }

    const player = gameState.players.find(p => p.id === telegramId);
    if (!player) {
      return { success: false, error: 'Игрок не найден' };
    }

    // Упрощенная логика: добавляем в отказавшиеся
    if (!gameState.svaraDeclined) {
      gameState.svaraDeclined = [];
    }
    gameState.svaraDeclined.push(telegramId);

    const action: GameAction = {
      type: 'fold',
      telegramId,
      timestamp: Date.now(),
      message: `Игрок ${player.username} решил пропустить свару`,
    };
    gameState.log.push(action);

    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);
    await this._checkSvaraCompletion(roomId, gameState);

    return { success: true, gameState };
  }

  async declareSvara(
    roomId: string,
    gameState: GameState,
    winners: Player[],
  ): Promise<void> {
    // Проверяем, что свара еще не объявлена
    if (gameState.status === 'svara_pending') {
      console.log(`[${roomId}] Svara already declared, skipping`);
      return;
    }

    const phaseResult = this.gameStateService.moveToNextPhase(
      gameState,
      'svara_pending',
    );
    gameState = phaseResult.updatedGameState;
    gameState.log.push(...phaseResult.actions);

    gameState.isSvara = true;
    gameState.svaraParticipants = winners.map((w) => w.id);
    gameState.winners = winners;
    gameState.svaraConfirmed = [];
    gameState.svaraDeclined = [];

    const svaraAction: GameAction = {
      type: 'svara',
      telegramId: 'system',
      timestamp: Date.now(),
      message: `Объявлена "Свара"! Банк ${gameState.pot} переходит в следующий раунд.`,
    };
    gameState.log.push(svaraAction);

    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);

    const timer = setTimeout(() => {
      this.resolveSvara(roomId).catch((error) => {
        console.error(`Error resolving svara for room ${roomId}:`, error);
      });
    }, TURN_DURATION_SECONDS * 1000);
    this.svaraTimers.set(roomId, timer);
  }

  private async _checkSvaraCompletion(roomId: string, gameState: GameState): Promise<void> {
    const totalPlayers = gameState.players.length;
    const decisionsCount = (gameState.svaraConfirmed?.length || 0) + (gameState.svaraDeclined?.length || 0);

    if (decisionsCount >= totalPlayers) {
      await this.resolveSvara(roomId);
    }
  }

  private async resolveSvara(roomId: string): Promise<void> {
    this.svaraTimers.delete(roomId); // Очищаем таймер

    const gameState = await this.redisService.getGameState(roomId);
    if (!gameState || gameState.status !== 'svara_pending') return;

    const participants = gameState.svaraConfirmed || [];

    // Упрощенная логика: если есть 2+ участника - начинаем свару, иначе завершаем игру
    if (participants.length >= 2) {
      await this.startSvaraGame(roomId, participants);
    } else {
      // Возвращаем флаг для завершения игры
      return;
    }
  }

  private async startSvaraGame(
    roomId: string,
    participantIds: string[],
  ): Promise<void> {
    let gameState = await this.redisService.getGameState(roomId);
    if (!gameState) return;

    const { updatedGameState, actions } =
      this.gameStateService.initializeSvaraGame(gameState, participantIds);
    gameState = updatedGameState;
    gameState.log.push(...actions);

    const dealResult = this.gameStateService.dealCardsToPlayers(gameState);
    gameState = dealResult.updatedGameState;
    gameState.log.push(...dealResult.actions);

    const phaseResult = this.gameStateService.moveToNextPhase(
      gameState,
      'blind_betting',
    );
    gameState = phaseResult.updatedGameState;
    gameState.log.push(...phaseResult.actions);

    gameState.currentPlayerIndex = this.playerService.findNextActivePlayer(
      gameState.players,
      gameState.dealerIndex,
    );
    // Устанавливаем время начала хода
    gameState.turnStartTime = Date.now();

    // await new Promise((resolve) => setTimeout(resolve, 3000));

    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);

    // Возвращаем флаг для запуска таймера
    return;
  }

  // Очистка таймеров свары
  clearSvaraTimer(roomId: string): void {
    const timer = this.svaraTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.svaraTimers.delete(roomId);
    }
  }

  // Очистка всех таймеров свары
  clearAllSvaraTimers(): void {
    for (const [roomId, timer] of this.svaraTimers.entries()) {
      clearTimeout(timer);
    }
    this.svaraTimers.clear();
  }
}
