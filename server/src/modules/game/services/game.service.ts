import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../services/redis.service';
import {
  GameState,
  GameAction,
  GameActionResult,
  Room,
  Player,
} from '../../../types/game';
import { CardService } from './card.service';
import { PlayerService } from './player.service';
import { BettingService } from './betting.service';
import { PotManager } from '../lib/pot-manager';
import { GameStateService } from './game-state.service';
import { UsersService } from '../../users/users.service';
import { UserDataDto } from '../dto/user-data.dto';
import { TURN_DURATION_SECONDS } from '../../../constants/game.constants';

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);
  private turnTimers = new Map<string, NodeJS.Timeout>(); // Таймеры для ходов игроков
  
  constructor(
    private readonly redisService: RedisService,
    private readonly cardService: CardService,
    private readonly playerService: PlayerService,
    private readonly bettingService: BettingService,
    private readonly gameStateService: GameStateService,
    private readonly usersService: UsersService,
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

  async getRooms(): Promise<Room[]> {
    const roomIds = await this.redisService.getActiveRooms();
    const rooms: Room[] = [];
    for (const roomId of roomIds) {
      const room = await this.redisService.getRoom(roomId);
      if (room) {
        rooms.push(room);
      }
    }
    return rooms;
  }

  async leaveRoom(roomId: string, telegramId: string): Promise<void> {
    const room = await this.redisService.getRoom(roomId);
    const gameState = await this.redisService.getGameState(roomId);

    if (room) {
      room.players = room.players.filter((pId) => pId !== telegramId);
      if (room.players.length === 0) {
        await this.redisService.removeRoom(roomId);
        await this.redisService.clearGameData(roomId);
        await this.redisService.publishRoomUpdate(roomId, null);
      } else {
        await this.redisService.setRoom(roomId, room);
        await this.redisService.publishRoomUpdate(roomId, room);
      }
    }

    if (gameState) {
      const playerIndex = gameState.players.findIndex(
        (p) => p.id === telegramId,
      );

      if (playerIndex > -1) {
        const removedPlayer = gameState.players[playerIndex];
        gameState.players.splice(playerIndex, 1);

        try {
          await this.usersService.updatePlayerBalance(
            telegramId,
            removedPlayer.balance,
          );
          await this.redisService.publishBalanceUpdate(
            telegramId,
            removedPlayer.balance,
          );
        } catch (error) {
          console.error(
            `Failed to save balance for leaving player ${telegramId}:`,
            error,
          );
        }

        const action: GameAction = {
          type: 'leave',
          telegramId,
          timestamp: Date.now(),
          message: `Игрок ${removedPlayer.username} покинул стол`,
        };
        gameState.log.push(action);

        const activePlayers = gameState.players.filter(
          (p) => p.isActive && !p.hasFolded && p.balance > 0,
        );
        const activeStatuses = ['ante', 'blind_betting', 'betting', 'showdown'];

        if (
          activePlayers.length === 1 &&
          activeStatuses.includes(gameState.status)
        ) {
          await this.redisService.setGameState(roomId, gameState);
          await this.redisService.publishGameUpdate(roomId, gameState);
          await this.endGameWithWinner(roomId, gameState);
          return;
        }

        await this.redisService.setGameState(roomId, gameState);
        await this.redisService.publishGameUpdate(roomId, gameState);
      }
    }

    await this.redisService.removePlayerFromRoom(roomId, telegramId);
  }

  async joinRoom(
    roomId: string,
    telegramId: string,
  ): Promise<GameActionResult> {
    const room = await this.redisService.getRoom(roomId);
    if (!room) {
      return { success: false, error: 'Комната не найдена' };
    }

    if (!room.players.includes(telegramId)) {
      room.players.push(telegramId);
      await this.redisService.setRoom(roomId, room);
      await this.redisService.addPlayerToRoom(roomId, telegramId);
      await this.redisService.publishRoomUpdate(roomId, room);
    }

    let gameState: GameState | null;
    try {
      gameState = await this.redisService.getGameState(roomId);
      if (!gameState) {
        console.error(
          `[joinRoom] Game state not found for room ${roomId}, user ${telegramId}`,
        );
        return { success: false, error: 'Игра не найдена' };
      }
    } catch (error) {
      console.error(
        `[joinRoom] Redis error getting game state for room ${roomId}, user ${telegramId}:`,
        error,
      );
      return {
        success: false,
        error: 'Ошибка подключения к серверу. Попробуйте еще раз.',
      };
    }

    return { success: true, gameState };
  }

  async sitDown(
    roomId: string,
    telegramId: string,
    position: number,
    userData: UserDataDto,
  ): Promise<GameActionResult> {
    let gameState: GameState | null;
    try {
      gameState = await this.redisService.getGameState(roomId);
      if (!gameState) {
        console.error(
          `[sitDown] Game state not found for room ${roomId}, user ${telegramId}`,
        );
        return { success: false, error: 'Игра не найдена' };
      }
    } catch (error) {
      console.error(
        `[sitDown] Redis error getting game state for room ${roomId}, user ${telegramId}:`,
        error,
      );
      return {
        success: false,
        error: 'Ошибка подключения к серверу. Попробуйте еще раз.',
      };
    }

    if (gameState.players.some((p) => p.position === position)) {
      return { success: false, error: 'Это место уже занято' };
    }

    if (gameState.players.some((p) => p.id === telegramId)) {
      return { success: false, error: 'Вы уже сидите за столом' };
    }

    const userProfile = await this.usersService.getProfile(telegramId);

    if (userProfile.balance < gameState.minBet) {
      return { success: false, gameState };
    }
    const isGameInProgress = gameState.status !== 'waiting';
    const newPlayer = this.playerService.createPlayer(
      telegramId,
      userData,
      position,
      userProfile.balance,
      !isGameInProgress,
    );
    gameState.players.push(newPlayer);

    const action: GameAction = {
      type: 'join',
      telegramId,
      timestamp: Date.now(),
      message: `Игрок ${newPlayer.username} сел за стол на позицию ${position}`,
    };
    gameState.log.push(action);

    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);

    const room = await this.redisService.getRoom(roomId);
    if (room && gameState.players.length >= 2 && room.status === 'waiting') {
      await this.startGame(roomId);
    }

    return { success: true, gameState };
  }

  async startGame(roomId: string): Promise<void> {
    const room = await this.redisService.getRoom(roomId);
    if (!room || (room.status !== 'waiting' && room.status !== 'finished')) {
      return;
    }

    if (room.status === 'waiting') {
      // await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    const gameState = await this.redisService.getGameState(roomId);

    if (room.status === 'finished' && gameState) {
      const minBalance = room.minBet;
      gameState.players = gameState.players.filter(
        (p) => p.balance >= minBalance,
      );
    }

    if (!gameState || gameState.players.length < 2) {
      room.status = 'waiting';
      await this.redisService.setRoom(roomId, room);
      if (gameState) {
        const newGameState = this.gameStateService.createInitialGameState(
          roomId,
          room.minBet,
        );
        newGameState.players = gameState.players.map((p) =>
          this.playerService.resetPlayerForNewGame(p, false),
        );
        await this.redisService.setGameState(roomId, newGameState);
        await this.redisService.publishGameUpdate(roomId, newGameState);
      }
      await this.redisService.publishRoomUpdate(roomId, room);
      return;
    }

    room.status = 'playing';
    await this.redisService.setRoom(roomId, room);
    await this.redisService.publishRoomUpdate(roomId, room);

    const { updatedGameState, actions } =
      this.gameStateService.initializeNewGame(gameState, room.winner);

    const finalGameState = updatedGameState;
    finalGameState.log.push(...actions);

    await this.redisService.setGameState(roomId, finalGameState);
    await this.redisService.publishGameUpdate(roomId, finalGameState);

    await this.startAntePhase(roomId);
  }

  async startAntePhase(roomId: string): Promise<void> {
    let gameState = await this.redisService.getGameState(roomId);
    if (!gameState || gameState.status !== 'ante') {
      return;
    }

    // ИСПРАВЛЕНИЕ: Проверяем случай свары с недостатком средств
    if (gameState.isSvara) {
      const svaraParticipants = gameState.players.filter(
        (p) => gameState!.svaraParticipants?.includes(p.id) && p.isActive,
      );

      // Если у участников свары нет денег для анте, делим банк пополам
      const participantsWithoutMoney = svaraParticipants.filter(
        (p) => p.balance < gameState!.minBet,
      );
      if (
        participantsWithoutMoney.length === svaraParticipants.length &&
        svaraParticipants.length === 2
      ) {
        const winAmount = Number((gameState.pot / 2).toFixed(2));
        const rake = Number((gameState.pot * 0.05).toFixed(2));

        for (const participant of svaraParticipants) {
          const playerIndex = gameState.players.findIndex(
            (p) => p.id === participant.id,
          );
          if (playerIndex !== -1) {
            gameState.players[playerIndex].balance += winAmount;

            const action: GameAction = {
              type: 'win',
              telegramId: participant.id,
              amount: winAmount,
              timestamp: Date.now(),
              message: `Игрок ${participant.username} получил ${winAmount} в сваре (недостаток средств)`,
            };
            gameState.log.push(action);
          }
        }

        // Добавляем действие о комиссии
        if (rake > 0) {
          const action: GameAction = {
            type: 'join',
            telegramId: 'system',
            timestamp: Date.now(),
            message: `Комиссия: ${rake}`,
          };
          gameState.log.push(action);
        }

        // Завершаем игру
        gameState.pot = 0;
        gameState.status = 'finished';
        gameState.winners = svaraParticipants;

        await this.redisService.setGameState(roomId, gameState);
        await this.redisService.publishGameUpdate(roomId, gameState);
        return;
      }
    }

    const { updatedGameState, actions } = this.bettingService.processAnte(
      gameState,
      gameState.minBet,
    );
    gameState = updatedGameState;
    gameState.log.push(...actions);

    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);

    const activePlayers = gameState.players.filter((p) => p.isActive);
    if (activePlayers.length < 2) {
      if (activePlayers.length === 1) {
        await this.endGameWithWinner(roomId, gameState);
      } else {
        await this.endGame(roomId, gameState, 'no_winner');
      }
      return;
    }

    const dealResult = this.gameStateService.dealCardsToPlayers(gameState);
    gameState = dealResult.updatedGameState;
    gameState.log.push(...dealResult.actions);

    // Сохраняем состояние с разданными картами
    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);

    // Ждем завершения анимации раздачи карт на клиенте (3 секунды)
    // await new Promise((resolve) => setTimeout(resolve, 3000));

    // Только после завершения анимации переходим в blind_betting
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
    // Устанавливаем время начала хода и запускаем таймер
    gameState.turnStartTime = Date.now();
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer) {
      this.startTurnTimer(roomId, currentPlayer.id);
    }

    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);
  }

  private svaraTimers: Map<string, NodeJS.Timeout> = new Map();

  async joinSvara(
    roomId: string,
    telegramId: string,
  ): Promise<GameActionResult> {
    let gameState: GameState | null;
    try {
      gameState = await this.redisService.getGameState(roomId);
      if (!gameState) {
        console.error(
          `[joinSvara] Game state not found for room ${roomId}, user ${telegramId}`,
        );
        return { success: false, error: 'Игра не найдена' };
      }
    } catch (error) {
      console.error(
        `[joinSvara] Redis error getting game state for room ${roomId}, user ${telegramId}:`,
        error,
      );
      return {
        success: false,
        error: 'Ошибка подключения к серверу. Попробуйте еще раз.',
      };
    }

    if (gameState.status !== 'svara_pending') {
      if (gameState.svaraConfirmed?.includes(telegramId)) {
        return { success: true, gameState };
      } else {
        return {
          success: false,
          error: 'Сейчас нельзя присоединиться к сваре',
        };
      }
    }

    if (
      gameState.svaraConfirmed?.includes(telegramId) ||
      gameState.svaraDeclined?.includes(telegramId)
    ) {
      return { success: true, gameState };
    }

    const player = gameState.players.find((p) => p.id === telegramId);
    if (!player) {
      return { success: false, error: 'Игрок не найден' };
    }

    const isOriginalWinner =
      gameState.svaraParticipants &&
      gameState.svaraParticipants.includes(telegramId);

    if (!gameState.svaraConfirmed) {
      gameState.svaraConfirmed = [];
    }

    if (isOriginalWinner) {
      if (!gameState.svaraConfirmed.includes(telegramId)) {
        gameState.svaraConfirmed.push(telegramId);
      }
    } else {
      const svaraBuyInAmount = gameState.pot;
      if (player.balance < svaraBuyInAmount) {
        return {
          success: false,
          error: 'Недостаточно средств для входа в свару',
        };
      }

      player.balance -= svaraBuyInAmount;
      gameState.pot += svaraBuyInAmount;
      player.totalBet = (player.totalBet || 0) + svaraBuyInAmount;

      if (!gameState.svaraConfirmed.includes(telegramId)) {
        gameState.svaraConfirmed.push(telegramId);
      }
    }

    const action: GameAction = {
      type: 'join',
      telegramId,
      timestamp: Date.now(),
      message: isOriginalWinner
        ? `Игрок ${player.username} участвует в сваре как победитель`
        : `Игрок ${player.username} присоединился к сваре, добавив в банк ${gameState.pot}`,
    };
    gameState.log.push(action);

    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);

    await this._checkSvaraCompletion(roomId, gameState);

    return { success: true, gameState };
  }

  async skipSvara(
    roomId: string,
    telegramId: string,
  ): Promise<GameActionResult> {
    const gameState = await this.redisService.getGameState(roomId);
    if (!gameState || gameState.status !== 'svara_pending') {
      return { success: false, error: 'Сейчас нельзя пропустить свару' };
    }

    if (
      gameState.svaraConfirmed?.includes(telegramId) ||
      gameState.svaraDeclined?.includes(telegramId)
    ) {
      return { success: true, gameState };
    }

    const player = gameState.players.find((p) => p.id === telegramId);
    if (!player) {
      return { success: false, error: 'Игрок не найден' };
    }

    if (!gameState.svaraDeclined) {
      gameState.svaraDeclined = [];
    }
    if (!gameState.svaraDeclined.includes(telegramId)) {
      gameState.svaraDeclined.push(telegramId);
    }

    const action: GameAction = {
      type: 'fold',
      telegramId,
      timestamp: Date.now(),
      message: `Игрок ${player.username} решил пропустить свару`,
    };
    gameState.log.push(action);

    await this.redisService.publishGameUpdate(roomId, gameState);

    await this._checkSvaraCompletion(roomId, gameState);

    return { success: true, gameState };
  }

  // Управление таймерами ходов
  private startTurnTimer(roomId: string, playerId: string): void {
    // Очищаем предыдущий таймер для этой комнаты
    console.log(`[TIMER_DEBUG] Starting timer for room: ${roomId}, player: ${playerId}`);
    const existingTimer = this.turnTimers.get(roomId);
    if (existingTimer) {
      console.log(`[TIMER_DEBUG] Clearing existing timer for room: ${roomId}`);
      clearTimeout(existingTimer);
    }
    this.turnTimers.delete(roomId);
    
    const timer = setTimeout(async () => {
      try {
        console.log(`[TIMER_DEBUG] Timer expired for room: ${roomId}, player: ${playerId}`);
        await this.handleAutoFold(roomId, playerId);
        this.turnTimers.delete(roomId);
      } catch (error) {
        console.error(`Error in turn timer for room ${roomId}:`, error);
        this.turnTimers.delete(roomId);
      }
    }, TURN_DURATION_SECONDS * 1000);
    
    this.turnTimers.set(roomId, timer);
    console.log(`[TIMER_DEBUG] Timer set for room: ${roomId}, player: ${playerId}`);
  }

  private clearTurnTimer(roomId: string): void {
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
      await this.leaveRoom(roomId, telegramId);

      const kickAction: GameAction = {
        type: 'fold',
        telegramId: 'system',
        timestamp: Date.now(),
        message: `Игрок ${player.username} исключен за бездействие (3 раза подряд)`,
      };
      gameState.log.push(kickAction);

      await this.redisService.setGameState(roomId, gameState);
      await this.redisService.publishGameUpdate(roomId, gameState);

      return { success: true };
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

    // Обрабатываем fold как обычно
    return this.handleFold(roomId, gameState, playerIndex);
  }

  async processAction(
    roomId: string,
    telegramId: string,
    action: string,
    amount?: number,
  ): Promise<GameActionResult> {
    if (action === 'join_svara') {
      return this.joinSvara(roomId, telegramId);
    }
    if (action === 'skip_svara') {
      return this.skipSvara(roomId, telegramId);
    }

    let gameState: GameState | null;
    try {
      gameState = await this.redisService.getGameState(roomId);
      if (!gameState) {
        console.error(
          `[processAction] Game state not found for room ${roomId}, user ${telegramId}, action ${action}`,
        );
        return { success: false, error: 'Игра не найдена' };
      }
    } catch (error) {
      console.error(
        `[processAction] Redis error getting game state for room ${roomId}, user ${telegramId}, action ${action}:`,
        error,
      );
      return {
        success: false,
        error: 'Ошибка подключения к серверу. Попробуйте еще раз.',
      };
    }

    const playerIndex = gameState.players.findIndex((p) => p.id === telegramId);
    const player = gameState.players[playerIndex];

    if (!player) {
      return { success: false, error: 'Игрок не найден в этой игре' };
    }

    // Очищаем таймер при любом действии игрока (кроме look)
    if (action !== 'look') {
      console.log(`[TIMER_DEBUG] Clearing timer for action: ${action}, player: ${telegramId}`);
      this.clearTurnTimer(roomId);
    } else {
      console.log(`[TIMER_DEBUG] NOT clearing timer for look action, player: ${telegramId}`);
    }

    // Сбрасываем счетчик бездействия при любом активном действии
    if (player.inactivityCount && player.inactivityCount > 0) {
      gameState.players[playerIndex] = this.playerService.updatePlayerStatus(
        player,
        { inactivityCount: 0 },
      );
    }

    // Проверяем, что это действительно ход игрока
    console.log(`[TURN_DEBUG] Action: ${action}, playerIndex: ${playerIndex}, currentPlayerIndex: ${gameState.currentPlayerIndex}, playerId: ${telegramId}`);
    if (gameState.currentPlayerIndex !== playerIndex) {
      console.log(`[TURN_DEBUG] ERROR: Not player's turn. Expected: ${gameState.currentPlayerIndex}, got: ${playerIndex}`);
      return { success: false, error: 'Сейчас не ваш ход' };
    }

    if (action === 'fold') {
      return this.handleFold(roomId, gameState, playerIndex);
    }

    if (
      player.hasLookedAndMustAct &&
      !['raise', 'all_in', 'call'].includes(action)
    ) {
      return {
        success: false,
        error:
          'После просмотра карт вы можете только повысить ставку, уравнять или сбросить карты',
      };
    }

    const { canPerform, error } = this.bettingService.canPerformAction(
      player,
      action,
      gameState,
    );
    if (!canPerform) {
      return { success: false, error };
    }

    switch (action) {
      case 'blind_bet':
      case 'look':
        return this.processBlindBettingAction(
          roomId,
          gameState,
          playerIndex,
          action,
        );
      case 'call':
        // Обрабатываем call в обеих фазах
        if (
          gameState.status === 'blind_betting' &&
          gameState.players[playerIndex].hasLookedAndMustAct
        ) {
          return this.processBlindBettingCallAction(
            roomId,
            gameState,
            playerIndex,
          );
        } else {
          return this.processBettingAction(
            roomId,
            gameState,
            playerIndex,
            action,
            amount,
          );
        }
      case 'raise':
        // В blind_betting raise после look обрабатываем специально
        if (
          gameState.status === 'blind_betting' &&
          gameState.players[playerIndex].hasLookedAndMustAct
        ) {
          return this.processBlindBettingRaiseAction(
            roomId,
            gameState,
            playerIndex,
            amount,
          );
        } else {
          return this.processBettingAction(
            roomId,
            gameState,
            playerIndex,
            action,
            amount,
          );
        }
      case 'all_in':
        return this.handleAllIn(roomId, gameState, playerIndex, amount);
      default:
        return {
          success: false,
          error: 'Недопустимое действие в текущей фазе',
        };
    }
  }

  private async handleFold(
    roomId: string,
    gameState: GameState,
    playerIndex: number,
  ): Promise<GameActionResult> {
    const player = gameState.players[playerIndex];

    gameState.players[playerIndex] = this.playerService.updatePlayerStatus(
      player,
      {
        hasFolded: true,
        lastAction: 'fold',
        hasLookedAndMustAct: false,
        inactivityCount: 0, // Сбрасываем счетчик при активном fold
      },
    );

    const foldAction: GameAction = {
      type: 'fold',
      telegramId: player.id,
      timestamp: Date.now(),
      message: `Игрок ${player.username} сбросил карты`,
    };
    gameState.log.push(foldAction);

    const playersInGame = gameState.players.filter((p) => !p.hasFolded);

    if (playersInGame.length <= 1) {
      // Only one player left, or none. End the game.
      await this.redisService.setGameState(roomId, gameState);
      await this.redisService.publishGameUpdate(roomId, gameState);
      await this.endGameWithWinner(roomId, gameState);
      return { success: true };
    }

    // Check players who can still make a move
    const playersWhoCanAct = playersInGame.filter(
      (p) => !p.isAllIn && p.balance > 0,
    );

    if (playersWhoCanAct.length < 2) {
      // If 0 or 1 players can still act, the betting part of the round is over.
      // This covers cases where remaining players are all-in.
      await this.endBettingRound(roomId, gameState);
      return { success: true };
    } else {
      // More than one player can still act, so the game continues.
      const aboutToActPlayerIndex = this.playerService.findNextActivePlayer(
        gameState.players,
        gameState.currentPlayerIndex,
      );

      // Check if the round is complete using the more robust betting service method
      const isComplete = this.bettingService.isBettingRoundComplete({
        ...gameState,
        currentPlayerIndex: aboutToActPlayerIndex,
      });

      if (isComplete) {
        await this.endBettingRound(roomId, gameState);
        return { success: true };
      } else {
        gameState.currentPlayerIndex = aboutToActPlayerIndex;
        // Устанавливаем время начала хода и запускаем таймер
        gameState.turnStartTime = Date.now();
        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        if (currentPlayer) {
          this.startTurnTimer(roomId, currentPlayer.id);
        }
      }
    }

    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);
    return { success: true, gameState };
  }

  private async processBlindBettingAction(
    roomId: string,
    gameState: GameState,
    playerIndex: number,
    action: string,
  ): Promise<GameActionResult> {
    const player = gameState.players[playerIndex];
    switch (action) {
      case 'blind_bet': {
        const blindBetAmount =
          gameState.lastBlindBet > 0
            ? gameState.lastBlindBet * 2
            : gameState.minBet;
        if (player.balance < blindBetAmount) {
          return { success: false, error: 'Недостаточно средств' };
        }
        const { updatedPlayer, action: blindAction } =
          this.playerService.processPlayerBet(
            player,
            blindBetAmount,
            'blind_bet',
          );
        gameState.players[playerIndex] = this.playerService.updatePlayerStatus(
          updatedPlayer,
          { lastAction: 'blind' },
        );
        gameState.lastBlindBet = blindBetAmount;
        gameState.lastActionAmount = blindBetAmount; // Устанавливаем для консистентности
        gameState.lastBlindBettorIndex = playerIndex;
        // Обновляем банк
        gameState.pot = Number((gameState.pot + blindBetAmount).toFixed(2));
        // gameState.chipCount += 1; // Увеличиваем счетчик фишек
        gameState.log.push(blindAction);
        gameState.isAnimating = true;
        gameState.animationType = 'chip_fly';

        await this.redisService.setGameState(roomId, gameState);
        await this.redisService.publishGameUpdate(roomId, gameState);

        await new Promise((resolve) => setTimeout(resolve, 1000));

        gameState.isAnimating = false;
        gameState.animationType = undefined;

        gameState.currentPlayerIndex = this.playerService.findNextActivePlayer(
          gameState.players,
          gameState.currentPlayerIndex,
        );
        // Устанавливаем время начала хода и запускаем таймер
        gameState.turnStartTime = Date.now();
        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        if (currentPlayer) {
          this.startTurnTimer(roomId, currentPlayer.id);
        }
        break;
      }
      case 'look': {
        const calculatedScore = this.cardService.calculateScore(player.cards);

        gameState.players[playerIndex] = this.playerService.updatePlayerStatus(
          player,
          {
            hasLooked: true,
            lastAction: 'look',
            hasLookedAndMustAct: true,
          },
        );
        gameState.players[playerIndex].score = calculatedScore;

        const lookAction: GameAction = {
          type: 'look',
          telegramId: player.id,
          timestamp: Date.now(),
          message: `Игрок ${player.username} посмотрел карты и имеет ${calculatedScore} очков`,
        };
        gameState.log.push(lookAction);

        // НЕ устанавливаем turnStartTime для look - это НЕ смена хода!
        console.log(`[LOOK_DEBUG] Look action completed, player: ${player.id}, currentPlayerIndex: ${gameState.currentPlayerIndex}`);
        break;
      }
    }

    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);
    return { success: true, gameState };
  }

  private async processBettingAction(
    roomId: string,
    gameState: GameState,
    playerIndex: number,
    action: string,
    amount?: number,
  ): Promise<GameActionResult> {
    const player = gameState.players[playerIndex];
    switch (action) {
      case 'call': {
        // Обрабатываем call только в фазе betting (не в blind_betting)

        // Проверяем, что это не call после look в blind_betting
        if (player.hasLookedAndMustAct) {
          return {
            success: false,
            error:
              'После просмотра карт вы можете только повысить ставку или сбросить карты',
          };
        }

        if (playerIndex === gameState.lastRaiseIndex) {
          await this.endBettingRound(roomId, gameState);
          return { success: true };
        }

        const callAmount = gameState.lastActionAmount;
        if (callAmount <= 0) {
          return {
            success: false,
            error: 'Нечего уравнивать',
          };
        }
        if (player.balance < callAmount) {
          return { success: false, error: 'Недостаточно средств' };
        }

        const { updatedPlayer, action: callAction } =
          this.playerService.processPlayerBet(player, callAmount, 'call');
        gameState.players[playerIndex] = updatedPlayer;
        gameState.lastActionAmount = callAmount;
        // Обновляем банк
        gameState.pot = Number((gameState.pot + callAmount).toFixed(2));
        // gameState.chipCount += 1; // Увеличиваем счетчик фишек
        gameState.log.push(callAction);
        break;
      }
      case 'raise': {
        const raiseAmount = amount || 0;
        const isPostLookRaise = player.hasLookedAndMustAct;

        const minRaiseAmount =
          gameState.lastBlindBet > 0
            ? gameState.lastBlindBet * 2
            : gameState.minBet;

        if (raiseAmount < minRaiseAmount) {
          return {
            success: false,
            error: `Минимальное повышение: ${minRaiseAmount}`,
          };
        }

        if (player.balance < raiseAmount) {
          return { success: false, error: 'Недостаточно средств' };
        }

        const { updatedPlayer, action: raiseAction } =
          this.playerService.processPlayerBet(player, raiseAmount, 'raise');

        raiseAction.message = `Игрок ${player.username} повысил до ${raiseAmount}`;

        gameState.lastRaiseIndex = playerIndex;
        gameState.lastActionAmount = raiseAmount;
        // Обновляем банк
        gameState.pot = Number((gameState.pot + raiseAmount).toFixed(2));
        // gameState.chipCount += 1; // Увеличиваем счетчик фишек
        gameState.log.push(raiseAction);

        // Проверяем переход в betting ДО сброса флага hasLookedAndMustAct
        if (isPostLookRaise) {
          const phaseResult = this.gameStateService.moveToNextPhase(
            gameState,
            'betting',
          );
          gameState = phaseResult.updatedGameState;
          gameState.log.push(...phaseResult.actions);

          for (let i = 0; i < gameState.players.length; i++) {
            if (
              i !== playerIndex &&
              gameState.players[i].isActive &&
              !gameState.players[i].hasFolded
            ) {
              gameState.players[i] = this.playerService.updatePlayerStatus(
                gameState.players[i],
                { hasLooked: true },
              );
            }
          }

          const scoreResult =
            this.gameStateService.calculateScoresForPlayers(gameState);
          gameState = scoreResult.updatedGameState;
          gameState.log.push(...scoreResult.actions);
        }

        // Сбрасываем флаг ПОСЛЕ проверки isPostLookRaise и перехода в betting
        gameState.players[playerIndex] = this.playerService.updatePlayerStatus(
          updatedPlayer,
          { hasLookedAndMustAct: false },
        );

        // Добавляем логику смены игрока для raise в blind_betting
        console.log(`[BLIND_BETTING_DEBUG] Raise action completed, changing turn`);
        const aboutToActPlayerIndex = this.playerService.findNextActivePlayer(
          gameState.players,
          gameState.currentPlayerIndex,
        );

        // Проверяем, будет ли следующий игрок якорем
        let anchorPlayerIndex: number | undefined = undefined;
        if (gameState.lastRaiseIndex !== undefined) {
          anchorPlayerIndex = gameState.lastRaiseIndex;
        } else if (gameState.lastBlindBettorIndex !== undefined) {
          anchorPlayerIndex = gameState.lastBlindBettorIndex;
        } else {
          anchorPlayerIndex = gameState.dealerIndex;
        }

        // Если следующий игрок - якорь, то круг завершается
        if (aboutToActPlayerIndex === anchorPlayerIndex) {
          console.log(`[BLIND_BETTING_DEBUG] Ending betting round, aboutToActPlayerIndex: ${aboutToActPlayerIndex}, anchorPlayerIndex: ${anchorPlayerIndex}`);
          await this.endBettingRound(roomId, gameState);
          return { success: true, gameState };
        } else {
          console.log(`[BLIND_BETTING_DEBUG] Changing turn from ${gameState.currentPlayerIndex} to ${aboutToActPlayerIndex}`);
          gameState.currentPlayerIndex = aboutToActPlayerIndex;
          // Устанавливаем время начала хода и запускаем таймер
          gameState.turnStartTime = Date.now();
          const currentPlayer = gameState.players[gameState.currentPlayerIndex];
          if (currentPlayer) {
            console.log(`[BLIND_BETTING_DEBUG] Starting timer for new player: ${currentPlayer.id}`);
            this.startTurnTimer(roomId, currentPlayer.id);
          }
        }
        break;
      }
    }

    // gameState.isAnimating = true;
    // gameState.animationType = 'chip_fly';

    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);

    // Check for round completion
    const activePlayers = gameState.players.filter(p => p.isActive && !p.hasFolded);
    const playersWhoCanAct = activePlayers.filter(p => !p.isAllIn && p.balance > 0);

    console.log(`[ROUND_DEBUG] Active players: ${activePlayers.length}, playersWhoCanAct: ${playersWhoCanAct.length}`);
    console.log(`[ROUND_DEBUG] Active players: ${activePlayers.map(p => `${p.username}(${p.id})`).join(', ')}`);
    console.log(`[ROUND_DEBUG] Players who can act: ${playersWhoCanAct.map(p => `${p.username}(${p.id})`).join(', ')}`);

    if (playersWhoCanAct.length < 2) {
        console.log(`[ROUND_DEBUG] Ending betting round - not enough players who can act`);
        await this.endBettingRound(roomId, gameState);
        return { success: true, gameState };
    }

    // ИСПРАВЛЕНИЕ: Проверяем завершение круга ДО передачи хода
    // Если следующий игрок будет якорем, то круг завершается
    const aboutToActPlayerIndex = this.playerService.findNextActivePlayer(
      gameState.players,
      gameState.currentPlayerIndex,
    );

    // Проверяем, будет ли следующий игрок якорем
    let anchorPlayerIndex: number | undefined = undefined;
    if (gameState.lastRaiseIndex !== undefined) {
      anchorPlayerIndex = gameState.lastRaiseIndex;
    } else if (gameState.lastBlindBettorIndex !== undefined) {
      anchorPlayerIndex = gameState.lastBlindBettorIndex;
    } else {
      anchorPlayerIndex = gameState.dealerIndex;
    }

    // Если следующий игрок - якорь, то круг завершается
    if (aboutToActPlayerIndex === anchorPlayerIndex) {
      console.log(`[TURN_CHANGE_DEBUG] Ending betting round, aboutToActPlayerIndex: ${aboutToActPlayerIndex}, anchorPlayerIndex: ${anchorPlayerIndex}`);
      await this.endBettingRound(roomId, gameState);
    } else {
      console.log(`[TURN_CHANGE_DEBUG] Changing turn from ${gameState.currentPlayerIndex} to ${aboutToActPlayerIndex}`);
      gameState.currentPlayerIndex = aboutToActPlayerIndex;
      // Устанавливаем время начала хода и запускаем таймер
      gameState.turnStartTime = Date.now();
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      if (currentPlayer) {
        console.log(`[TURN_CHANGE_DEBUG] Starting timer for new player: ${currentPlayer.id}`);
        this.startTurnTimer(roomId, currentPlayer.id);
      }
      await this.redisService.setGameState(roomId, gameState);
      await this.redisService.publishGameUpdate(roomId, gameState);
    }
    return { success: true, gameState };
  }

  private async endBettingRound(
    roomId: string,
    gameState: GameState,
  ): Promise<void> {
    const scoreResult =
      this.gameStateService.calculateScoresForPlayers(gameState);
    gameState = scoreResult.updatedGameState;
    gameState.log.push(...scoreResult.actions);

    // Проверяем количество активных игроков
    const activePlayers = gameState.players.filter((p) => !p.hasFolded);

    if (activePlayers.length === 1) {
      // Если остался только 1 активный игрок - игра заканчивается
      await this.endGameWithWinner(roomId, gameState);
    } else {
      // Если активных игроков больше 1 - переходим к showdown
      const phaseResult = this.gameStateService.moveToNextPhase(
        gameState,
        'showdown',
      );
      gameState = phaseResult.updatedGameState;
      gameState.log.push(...phaseResult.actions);

      await this.redisService.setGameState(roomId, gameState);
      await this.redisService.publishGameUpdate(roomId, gameState);

      // После showdown определяем победителей
      setTimeout(() => {
        this.determineWinnersAfterShowdown(roomId, gameState).catch((error) => {
          console.error(`Error determining winners for room ${roomId}:`, error);
        });
      }, 3000); // Ждем 3 секунды для показа карт в showdown
    }
  }

  private async determineWinnersAfterShowdown(
    roomId: string,
    gameState: GameState,
  ): Promise<void> {
    const activePlayers = gameState.players.filter((p) => !p.hasFolded);
    const overallWinners = this.playerService.determineWinners(activePlayers);

    // Рассчитываем выигрыш для каждого победителя
    const rake = Number((gameState.pot * 0.05).toFixed(2));
    const winAmount = gameState.pot - rake;
    const winPerPlayer = Number((winAmount / overallWinners.length).toFixed(2));

    // Устанавливаем lastWinAmount для победителей
    for (const winner of overallWinners) {
      const playerInState = gameState.players.find((p) => p.id === winner.id);
      if (playerInState) {
        playerInState.lastWinAmount = winPerPlayer;
      }
    }

    gameState.winners = overallWinners;

    console.log(
      `[${roomId}] Winners determined after showdown:`,
      overallWinners.map((w) => ({
        id: w.id,
        username: w.username,
        lastWinAmount: gameState.players.find((p) => p.id === w.id)
          ?.lastWinAmount,
      })),
    );

    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);

    // После showdown проверяем, нужна ли свара
    if (overallWinners.length > 1) {
      // Если несколько победителей - объявляем свару
      this.declareSvara(roomId, gameState, overallWinners).catch((error) => {
        console.error(`Error declaring svara for room ${roomId}:`, error);
      });
    } else {
      // Если один победитель - распределяем выигрыш
      this.distributeWinnings(roomId).catch((error) => {
        console.error(
          `Failed to distribute winnings for room ${roomId}:`,
          error,
        );
      });
    }
  }

  private async _checkSvaraCompletion(
    roomId: string,
    gameState: GameState,
  ): Promise<void> {
    const totalPlayers = gameState.players.length;
    const decisionsCount =
      (gameState.svaraConfirmed?.length || 0) +
      (gameState.svaraDeclined?.length || 0);

    if (decisionsCount >= totalPlayers) {
      await this.resolveSvara(roomId);
    }
  }

  private async resolveSvara(roomId: string): Promise<void> {
    if (this.svaraTimers.has(roomId)) {
      clearTimeout(this.svaraTimers.get(roomId));
      this.svaraTimers.delete(roomId);
    }

    const gameState = await this.redisService.getGameState(roomId);
    if (!gameState || gameState.status !== 'svara_pending') {
      return;
    }

    const participants = gameState.svaraConfirmed || [];

    if (participants.length >= 2) {
      // ИСПРАВЛЕНИЕ: Проверяем, могут ли участники свары внести деньги
      const svaraPlayers = gameState.players.filter((p) =>
        participants.includes(p.id),
      );
      const playersWithoutMoney = svaraPlayers.filter(
        (p) => p.balance < gameState.minBet,
      );

      // Если у всех участников свары нет денег, делим банк пополам
      if (
        playersWithoutMoney.length === svaraPlayers.length &&
        svaraPlayers.length === 2
      ) {
        const winAmount = Number((gameState.pot / 2).toFixed(2));
        const rake = Number((gameState.pot * 0.05).toFixed(2));

        for (const player of svaraPlayers) {
          const playerIndex = gameState.players.findIndex(
            (p) => p.id === player.id,
          );
          if (playerIndex !== -1) {
            gameState.players[playerIndex].balance += winAmount;

            const action: GameAction = {
              type: 'win',
              telegramId: player.id,
              amount: winAmount,
              timestamp: Date.now(),
              message: `Игрок ${player.username} получил ${winAmount} в сваре (недостаток средств)`,
            };
            gameState.log.push(action);
          }
        }

        // Добавляем действие о комиссии
        if (rake > 0) {
          const action: GameAction = {
            type: 'join',
            telegramId: 'system',
            timestamp: Date.now(),
            message: `Комиссия: ${rake}`,
          };
          gameState.log.push(action);
        }

        // Завершаем игру
        gameState.pot = 0;
        gameState.status = 'finished';
        gameState.winners = svaraPlayers;

        await this.redisService.setGameState(roomId, gameState);
        await this.redisService.publishGameUpdate(roomId, gameState);

        // Запускаем новую игру через endGame
        await this.endGame(roomId, gameState, 'svara');
        return;
      }

      await this.startSvaraGame(roomId, participants);
    } else if (participants.length === 1) {
      await this.endGameWithWinner(roomId, gameState);
    } else {
      await this.endGame(roomId, gameState, 'no_winner');
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
    // Устанавливаем время начала хода и запускаем таймер
    gameState.turnStartTime = Date.now();
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer) {
      this.startTurnTimer(roomId, currentPlayer.id);
    }

    // await new Promise((resolve) => setTimeout(resolve, 3000));

    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);
  }

  private async endGameWithWinner(
    roomId: string,
    gameState: GameState,
  ): Promise<void> {
    if (!gameState) return;
    
    // Очищаем таймер при завершении игры
    this.clearTurnTimer(roomId);

    const scoreResult =
      this.gameStateService.calculateScoresForPlayers(gameState);
    gameState = scoreResult.updatedGameState;
    gameState.log.push(...scoreResult.actions);

    const activePlayers = gameState.players.filter((p) => !p.hasFolded);
    const overallWinners = this.playerService.determineWinners(activePlayers);

    // Рассчитываем выигрыш для каждого победителя
    const rake = Number((gameState.pot * 0.05).toFixed(2));
    const winAmount = gameState.pot - rake;
    const winPerPlayer = Number((winAmount / overallWinners.length).toFixed(2));

    // Устанавливаем lastWinAmount для победителей
    for (const winner of overallWinners) {
      const playerInState = gameState.players.find((p) => p.id === winner.id);
      if (playerInState) {
        playerInState.lastWinAmount = winPerPlayer;
      }
    }

    // ВСЕГДА сначала переходим в showdown для показа карт
    const phaseResult = this.gameStateService.moveToNextPhase(
      gameState,
      'showdown',
    );
    gameState = phaseResult.updatedGameState;
    gameState.log.push(...phaseResult.actions);
    gameState.winners = overallWinners;

    console.log(
      `[${roomId}] Winners set in endGameWithWinner:`,
      overallWinners.map((w) => ({
        id: w.id,
        username: w.username,
        lastWinAmount: gameState.players.find((p) => p.id === w.id)
          ?.lastWinAmount,
      })),
    );

    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);

    // После showdown проверяем, нужна ли свара
    setTimeout(() => {
      if (overallWinners.length > 1) {
        // Если несколько победителей - объявляем свару
        this.declareSvara(roomId, gameState, overallWinners).catch((error) => {
          console.error(`Error declaring svara for room ${roomId}:`, error);
        });
      } else {
        // Если один победитель - распределяем выигрыш
        this.distributeWinnings(roomId).catch((error) => {
          console.error(
            `Failed to distribute winnings for room ${roomId}:`,
            error,
          );
        });
      }
    }, 3000); // Ждем 3 секунды для показа карт в showdown
  }

  private async declareSvara(
    roomId: string,
    gameState: GameState,
    winners: Player[],
  ): Promise<void> {
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

  private async distributeWinnings(roomId: string): Promise<void> {
    let gameState = await this.redisService.getGameState(roomId);
    if (!gameState) {
      console.error(
        `[distributeWinnings] Game state not found for room ${roomId}`,
      );
      return;
    }

    // Reset lastWinAmount only for non-winners
    for (const p of gameState.players) {
      if (!gameState.winners?.some((w) => w.id === p.id)) {
        p.lastWinAmount = 0;
      }
    }

    const activePlayersWithBets = gameState.players.filter(
      (p) => !p.hasFolded && p.totalBet > 0,
    );
    if (activePlayersWithBets.length === 0 && gameState.pot === 0) {
      // No bets were made, just end the game
      await this.endGame(roomId, gameState, 'no_winner');
      return;
    }

    const potManager = new PotManager();
    // Use all players for processing, as even folded players might be in the pot from ante
    potManager.processBets(gameState.players);

    const refunds = potManager.getReturnedBets();
    const potWinnersList = potManager.getWinners(gameState.players);

    // 1. Process Refunds
    if (refunds.size > 0) {
      for (const [playerId, refundAmount] of refunds.entries()) {
        const player = gameState.players.find((p) => p.id === playerId);
        if (player && refundAmount > 0) {
          player.balance += refundAmount;
          const refundAction: GameAction = {
            type: 'return_bet',
            telegramId: playerId,
            amount: refundAmount,
            timestamp: Date.now(),
            message: `Игроку ${player.username} возвращена не-коллированная ставка ${refundAmount}`,
          };
          gameState.log.push(refundAction);
        }
      }
    }

    // 2. Process Winnings from each pot
    let totalRake = 0;

    // Находим основной банк - самый большой по размеру
    const mainPotIndex = potWinnersList.reduce((maxIndex, pot, index) => {
      return pot.amount > potWinnersList[maxIndex].amount ? index : maxIndex;
    }, 0);

    for (let i = 0; i < potWinnersList.length; i++) {
      const potResult = potWinnersList[i];
      const { winners: potWinnerPlayers, amount } = potResult;

      if (amount <= 0 || potWinnerPlayers.length === 0) {
        continue;
      }

      // Проверяем, является ли это основным банком (самый большой по размеру)
      const isMainPot = i === mainPotIndex;

      if (isMainPot) {
        // Основной банк - проверяем на ничью
        if (potWinnerPlayers.length > 1 && amount > 0) {
          // Ничья в основном банке - объявляем свару (только если банк не пустой)

          const svaraAction: GameAction = {
            type: 'svara',
            telegramId: 'system',
            timestamp: Date.now(),
            message: `Объявлена "Свара"! Банк ${amount} переходит в следующий раунд.`,
          };
          gameState.log.push(svaraAction);

          // Переходим в фазу свары
          const phaseResult = this.gameStateService.moveToNextPhase(
            gameState,
            'svara_pending',
          );
          gameState = phaseResult.updatedGameState;
          gameState.log.push(...phaseResult.actions);

          gameState.isSvara = true;
          gameState.svaraParticipants = potWinnerPlayers.map((w) => w.id);
          gameState.winners = potWinnerPlayers;
          gameState.svaraConfirmed = [];
          gameState.svaraDeclined = [];

          // Сохраняем банк для свары
          gameState.pot = amount;

          await this.redisService.setGameState(roomId, gameState);
          await this.redisService.publishGameUpdate(roomId, gameState);

          // Запускаем таймер свары
          const timer = setTimeout(() => {
            this.resolveSvara(roomId).catch((error) => {
              console.error(`Error resolving svara for room ${roomId}:`, error);
            });
          }, 30000); // 30 секунд на решение
          this.svaraTimers.set(roomId, timer);

          return; // Выходим из метода, свара объявлена
        } else if (amount > 0) {
          // Один победитель в основном банке - разыгрываем как обычно
          const rake = Number((amount * 0.05).toFixed(2));
          totalRake += rake;
          const winAmount = amount - rake;

          const winner = potWinnerPlayers[0];
          const playerInState = gameState.players.find(
            (p) => p.id === winner.id,
          );
          if (playerInState) {
            playerInState.balance += winAmount;

            const winAction: GameAction = {
              type: 'win',
              telegramId: winner.id,
              amount: winAmount,
              timestamp: Date.now(),
              message: `Игрок ${playerInState.username} выиграл ${winAmount}`,
            };
            gameState.log.push(winAction);
          }
        } else {
          // Основной банк пустой - завершаем игру без выигрыша
          const noWinAction: GameAction = {
            type: 'join',
            telegramId: 'system',
            timestamp: Date.now(),
            message: 'Основной банк пустой - игра завершена без выигрыша',
          };
          gameState.log.push(noWinAction);
        }
      } else {
        // Боковой банк - разыгрываем сразу
        const rake = Number((amount * 0.05).toFixed(2));
        totalRake += rake;
        const winAmount = amount - rake;
        const winPerPlayer = Number(
          (winAmount / potWinnerPlayers.length).toFixed(2),
        );

        for (const winner of potWinnerPlayers) {
          const playerInState = gameState.players.find(
            (p) => p.id === winner.id,
          );
          if (playerInState) {
            playerInState.balance += winPerPlayer;

            const winAction: GameAction = {
              type: 'win',
              telegramId: winner.id,
              amount: winPerPlayer,
              timestamp: Date.now(),
              message: `Игрок ${playerInState.username} выиграл боковой банк ${winPerPlayer}`,
            };
            gameState.log.push(winAction);
          }
        }
      }
    }

    // Log total rake
    if (totalRake > 0) {
      const rakeAction: GameAction = {
        type: 'join', // Using 'join' for system messages as before
        telegramId: 'system',
        timestamp: Date.now(),
        message: `Общая комиссия: ${totalRake.toFixed(2)}`,
      };
      gameState.log.push(rakeAction);
    }

    // 3. Finalize state (только если свара не объявлена)
    gameState.pot = 0;
    gameState.rake = totalRake;
    // gameState.chipCount = 0;
    // Winners are already set in gameState.winners from endGameWithWinner

    // 4. Persist final balances
    for (const player of gameState.players) {
      await this.usersService.updatePlayerBalance(player.id, player.balance);
      await this.redisService.publishBalanceUpdate(player.id, player.balance);
    }

    // 5. Move to finished state
    const phaseResult = this.gameStateService.moveToNextPhase(
      gameState,
      'finished',
    );
    gameState = phaseResult.updatedGameState;
    gameState.log.push(...phaseResult.actions);

    // Ensure winners are preserved for client animation
    console.log(
      `[${roomId}] Final winners:`,
      gameState.winners?.map((w) => ({
        id: w.id,
        username: w.username,
        lastWinAmount: w.lastWinAmount,
      })),
    );

    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);

    this.logger.log(`[${roomId}] Winnings distributed. Ending game.`);
    await this.endGame(roomId, gameState, 'winner');
  }

  private async endGame(
    roomId: string,
    gameState: GameState,
    reason: 'winner' | 'no_winner' | 'svara',
  ): Promise<void> {
    const room = await this.redisService.getRoom(roomId);
    if (room) {
      room.status = 'finished';
      room.finishedAt = new Date();
      room.winner =
        reason === 'winner' && gameState.winners
          ? gameState.winners[0]?.id
          : undefined;
      await this.redisService.setRoom(roomId, room);
      await this.redisService.publishRoomUpdate(roomId, room);
    }

    this.logger.log(`[${roomId}] Game ended. Scheduling new game.`);
    setTimeout(() => {
      this.startGame(roomId).catch((err) =>
        console.error(`Failed to auto-restart game ${roomId}`, err),
      );
    }, 5000);
  }

  private async handleAllIn(
    roomId: string,
    gameState: GameState,
    playerIndex: number,
    amount?: number,
  ): Promise<GameActionResult> {
    const player = gameState.players[playerIndex];
    const allInAmount = amount ?? player.balance;

    if (allInAmount > player.balance) {
      return { success: false, error: 'Недостаточно средств' };
    }

    // Определяем, является ли all-in вынужденным call или добровольным raise
    const isForcedCall =
      gameState.lastActionAmount > 0 &&
      player.balance < gameState.lastActionAmount;
    const isVoluntaryRaise =
      !isForcedCall &&
      (allInAmount > gameState.lastActionAmount ||
        gameState.lastActionAmount === 0);

    const { updatedPlayer, action: allInAction } =
      this.playerService.processPlayerBet(player, allInAmount, 'all_in');

    // Устанавливаем правильный lastAction в зависимости от типа all-in
    const lastAction = isForcedCall ? 'call' : 'raise';

    gameState.players[playerIndex] = this.playerService.updatePlayerStatus(
      updatedPlayer,
      {
        isAllIn: true,
        lastAction: lastAction,
      },
    );

    gameState.lastActionAmount = allInAmount;

    // Устанавливаем якорь только для добровольного raise all-in
    if (isVoluntaryRaise) {
      gameState.lastRaiseIndex = playerIndex;
    }
    // Обновляем банк
    gameState.pot = Number((gameState.pot + allInAmount).toFixed(2));
    // gameState.chipCount += 1; // Увеличиваем счетчик фишек
    gameState.log.push(allInAction);

    // Проверяем, нужно ли перейти в betting (если это all_in после look в blind_betting)
    if (gameState.status === 'blind_betting' && player.hasLookedAndMustAct) {
      // Переходим в фазу betting
      const phaseResult = this.gameStateService.moveToNextPhase(
        gameState,
        'betting',
      );
      gameState = phaseResult.updatedGameState;
      gameState.log.push(...phaseResult.actions);

      // Открываем карты у всех игроков
      for (let i = 0; i < gameState.players.length; i++) {
        if (
          i !== playerIndex &&
          gameState.players[i].isActive &&
          !gameState.players[i].hasFolded
        ) {
          gameState.players[i] = this.playerService.updatePlayerStatus(
            gameState.players[i],
            { hasLooked: true },
          );
        }
      }

      // Рассчитываем очки для всех игроков
      const scoreResult =
        this.gameStateService.calculateScoresForPlayers(gameState);
      gameState = scoreResult.updatedGameState;
      gameState.log.push(...scoreResult.actions);
    }

    // Усовершенствованная логика завершения раунда для all-in
    const activePlayers = gameState.players.filter(
      (p) => p.isActive && !p.hasFolded,
    );
    // Игроки, которые еще могут действовать (не all-in)
    const playersWhoCanStillBet = activePlayers.filter((p) => !p.isAllIn);

    // Если all-in был рейзом, и есть кому на него отвечать, игра продолжается.
    // `isVoluntaryRaise` был определен ранее в методе.
    if (isVoluntaryRaise && playersWhoCanStillBet.length > 0) {
      this.logger.log(
        `[${roomId}] All-in был рейзом, передаем ход следующему игроку.`,
      );
      const nextPlayerIndex = this.playerService.findNextActivePlayer(
        gameState.players,
        gameState.currentPlayerIndex,
      );
      gameState.currentPlayerIndex = nextPlayerIndex;
      await this.redisService.setGameState(roomId, gameState);
      await this.redisService.publishGameUpdate(roomId, gameState);
    } else {
      // All-in был коллом, или на рейз некому отвечать. Раунд завершается.
      this.logger.log(
        `[${roomId}] All-in не требует ответа или отвечать некому. Завершение раунда.`,
      );
      await this.endBettingRound(roomId, gameState);
    }

    return { success: true, gameState };
  }

  private async processBlindBettingCallAction(
    roomId: string,
    gameState: GameState,
    playerIndex: number,
  ): Promise<GameActionResult> {
    const player = gameState.players[playerIndex];

    // В blind_betting call означает оплату просмотра карт. Сумма должна быть равна последней ставке вслепую * 2.
    const callAmount =
      gameState.lastBlindBet > 0
        ? gameState.lastBlindBet * 2
        : gameState.minBet * 2;

    if (callAmount <= 0) {
      return {
        success: false,
        error: 'Нечего уравнивать',
      };
    }

    if (player.balance < callAmount) {
      return { success: false, error: 'Недостаточно средств' };
    }

    const { updatedPlayer, action: callAction } =
      this.playerService.processPlayerBet(player, callAmount, 'call');

    gameState.players[playerIndex] = this.playerService.updatePlayerStatus(
      updatedPlayer,
      { hasLookedAndMustAct: false },
    );

    gameState.lastActionAmount = callAmount;
    // Обновляем банк
    gameState.pot = Number((gameState.pot + callAmount).toFixed(2));
    // gameState.chipCount += 1; // Увеличиваем счетчик фишек
    gameState.log.push(callAction);

    // Call после look переводит игру в фазу betting и открывает карты
    const phaseResult = this.gameStateService.moveToNextPhase(
      gameState,
      'betting',
    );
    gameState = phaseResult.updatedGameState;
    gameState.log.push(...phaseResult.actions);

    // Открываем карты у всех игроков
    for (let i = 0; i < gameState.players.length; i++) {
      if (
        i !== playerIndex &&
        gameState.players[i].isActive &&
        !gameState.players[i].hasFolded
      ) {
        gameState.players[i] = this.playerService.updatePlayerStatus(
          gameState.players[i],
          { hasLooked: true },
        );
      }
    }

    // Рассчитываем очки для всех игроков
    const scoreResult =
      this.gameStateService.calculateScoresForPlayers(gameState);
    gameState = scoreResult.updatedGameState;
    gameState.log.push(...scoreResult.actions);

    // Устанавливаем текущего игрока как якорного (как в raise)
    gameState.lastRaiseIndex = playerIndex;

    // Анимация и проверка завершения круга (как в processBettingAction)
    // gameState.isAnimating = true;
    // gameState.animationType = 'chip_fly';

    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);

    // await new Promise((resolve) => setTimeout(resolve, 1000));

    // gameState.isAnimating = false;
    // gameState.animationType = undefined;

    // Проверяем завершение круга ДО передачи хода (как в raise)
    const aboutToActPlayerIndex = this.playerService.findNextActivePlayer(
      gameState.players,
      gameState.currentPlayerIndex,
    );

    // Проверяем, будет ли следующий игрок якорем
    let anchorPlayerIndex: number | undefined = undefined;
    if (gameState.lastRaiseIndex !== undefined) {
      anchorPlayerIndex = gameState.lastRaiseIndex;
    } else if (gameState.lastBlindBettorIndex !== undefined) {
      anchorPlayerIndex = gameState.lastBlindBettorIndex;
    } else {
      anchorPlayerIndex = gameState.dealerIndex;
    }

    // Если следующий игрок - якорь, то круг завершается
    if (aboutToActPlayerIndex === anchorPlayerIndex) {
      await this.endBettingRound(roomId, gameState);
    } else {
      gameState.currentPlayerIndex = aboutToActPlayerIndex;
      await this.redisService.setGameState(roomId, gameState);
      await this.redisService.publishGameUpdate(roomId, gameState);
    }

    return { success: true, gameState };
  }

  private async processBlindBettingRaiseAction(
    roomId: string,
    gameState: GameState,
    playerIndex: number,
    amount?: number,
  ): Promise<GameActionResult> {
    const player = gameState.players[playerIndex];
    const raiseAmount = amount || 0;

    const minRaiseAmount =
      gameState.lastBlindBet > 0
        ? gameState.lastBlindBet * 2
        : gameState.minBet;

    if (raiseAmount < minRaiseAmount) {
      return {
        success: false,
        error: `Минимальное повышение: ${minRaiseAmount}`,
      };
    }

    if (player.balance < raiseAmount) {
      return { success: false, error: 'Недостаточно средств' };
    }

    const { updatedPlayer, action: raiseAction } =
      this.playerService.processPlayerBet(player, raiseAmount, 'raise');

    raiseAction.message = `Игрок ${player.username} повысил до ${raiseAmount}`;

    gameState.players[playerIndex] = this.playerService.updatePlayerStatus(
      updatedPlayer,
      { hasLookedAndMustAct: false },
    );

    gameState.lastRaiseIndex = playerIndex;
    gameState.lastActionAmount = raiseAmount;
    // Обновляем банк
    gameState.pot = Number((gameState.pot + raiseAmount).toFixed(2));
    // gameState.chipCount += 1; // Увеличиваем счетчик фишек
    gameState.log.push(raiseAction);

    // Raise после look в blind_betting переводит игру в фазу betting
    const phaseResult = this.gameStateService.moveToNextPhase(
      gameState,
      'betting',
    );
    gameState = phaseResult.updatedGameState;
    gameState.log.push(...phaseResult.actions);

    // Открываем карты у всех игроков
    for (let i = 0; i < gameState.players.length; i++) {
      if (
        i !== playerIndex &&
        gameState.players[i].isActive &&
        !gameState.players[i].hasFolded
      ) {
        gameState.players[i] = this.playerService.updatePlayerStatus(
          gameState.players[i],
          { hasLooked: true },
        );
      }
    }

    // Рассчитываем очки для всех игроков
    const scoreResult =
      this.gameStateService.calculateScoresForPlayers(gameState);
    gameState = scoreResult.updatedGameState;
    gameState.log.push(...scoreResult.actions);

    // Анимация
    // gameState.isAnimating = true;
    // gameState.animationType = 'chip_fly';

    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);

    // await new Promise((resolve) => setTimeout(resolve, 1000));

    // gameState.isAnimating = false;
    // gameState.animationType = undefined;

    // Проверяем завершение круга ДО передачи хода
    const aboutToActPlayerIndex = this.playerService.findNextActivePlayer(
      gameState.players,
      gameState.currentPlayerIndex,
    );

    // Определяем якорного игрока
    let anchorPlayerIndex: number | undefined = undefined;
    if (gameState.lastRaiseIndex !== undefined) {
      anchorPlayerIndex = gameState.lastRaiseIndex;
    } else if (gameState.lastBlindBettorIndex !== undefined) {
      anchorPlayerIndex = gameState.lastBlindBettorIndex;
    } else {
      anchorPlayerIndex = gameState.dealerIndex;
    }

    // Если следующий игрок - якорь, то круг завершается
    if (aboutToActPlayerIndex === anchorPlayerIndex) {
      console.log(`[BLIND_BETTING_RAISE_DEBUG] Ending betting round, aboutToActPlayerIndex: ${aboutToActPlayerIndex}, anchorPlayerIndex: ${anchorPlayerIndex}`);
      await this.endBettingRound(roomId, gameState);
    } else {
      console.log(`[BLIND_BETTING_RAISE_DEBUG] Changing turn from ${gameState.currentPlayerIndex} to ${aboutToActPlayerIndex}`);
      // Очищаем старый таймер перед сменой игрока
      this.clearTurnTimer(roomId);
      gameState.currentPlayerIndex = aboutToActPlayerIndex;
      // Устанавливаем время начала хода и запускаем таймер
      gameState.turnStartTime = Date.now();
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      if (currentPlayer) {
        console.log(`[BLIND_BETTING_RAISE_DEBUG] Starting timer for new player: ${currentPlayer.id}`);
        this.startTurnTimer(roomId, currentPlayer.id);
      }
      await this.redisService.setGameState(roomId, gameState);
      await this.redisService.publishGameUpdate(roomId, gameState);
    }

    return { success: true, gameState };
  }
}
