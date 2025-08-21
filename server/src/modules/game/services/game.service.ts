import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../services/redis.service';
import {
  GameState,
  GameAction,
  GameActionResult,
  Room,
} from '../../../types/game';
import { CardService } from './card.service';
import { PlayerService } from './player.service';
import { BettingService } from './betting.service';
import { GameStateService } from './game-state.service';
import { UsersService } from '../../users/users.service';
import { UserDataDto } from '../dto/user-data.dto';
import { TURN_DURATION_SECONDS } from '../../../constants/game.constants';

@Injectable()
export class GameService {
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
    if (!room) return;

    room.players = room.players.filter((playerId) => playerId !== telegramId);

    // Проверяем, если комната стала пустой - удаляем её сразу
    if (room.players.length === 0) {
      console.log(`Room ${roomId} is now empty, removing it`);
      await this.redisService.removeRoom(roomId);
      await this.redisService.clearGameData(roomId);
      await this.redisService.removePlayerFromRoom(roomId, telegramId);
      // Отправляем уведомление об удалении комнаты
      await this.redisService.publishRoomUpdate(roomId, null);
      return;
    }

    await this.redisService.setRoom(roomId, room);
    await this.redisService.publishRoomUpdate(roomId, room);

    const gameState = await this.redisService.getGameState(roomId);
    if (gameState) {
      const playerIndex = gameState.players.findIndex(
        (p) => p.id === telegramId,
      );
      if (playerIndex > -1) {
        const removedPlayer = gameState.players.splice(playerIndex, 1)[0];

        // Сохраняем баланс игрока в БД при выходе из комнаты
        try {
          await this.usersService.updatePlayerBalance(
            telegramId,
            removedPlayer.balance,
          );
          console.log(
            `Player ${telegramId} left room - balance saved to DB: ${removedPlayer.balance}`,
          );

          // Отправляем обновление баланса игроку
          await this.redisService.publishBalanceUpdate(
            telegramId,
            removedPlayer.balance,
          );
        } catch (error) {
          console.error(
            `Failed to save balance to DB for leaving player ${telegramId}:`,
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
        await this.redisService.setGameState(roomId, gameState);
        await this.redisService.publishGameUpdate(roomId, gameState);

        // Проверяем, остался ли один игрок во время активной игры
        const activeStatuses = ['ante', 'blind_betting', 'betting', 'showdown'];
        if (
          gameState.players.length === 1 &&
          activeStatuses.includes(gameState.status)
        ) {
          const remainingPlayer = gameState.players[0];
          console.log(
            `Only one player remaining during active game. Auto-win for player: ${remainingPlayer.id}`,
          );
          await this.endGameWithWinner(roomId, remainingPlayer.id);
          return;
        }

        // Если игрок выходит после завершения раунда, пытаемся запустить новую игру
        if (gameState.status === 'finished') {
          console.log(
            `Player left during 'finished' state. Attempting to start a new game for room ${roomId}.`,
          );
          await this.startGame(roomId);
          return; // Выходим, чтобы не выполнять лишний код ниже
        }
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

    const gameState = await this.redisService.getGameState(roomId);
    if (!gameState) {
      return { success: false, error: 'Игра не найдена' };
    }

    return { success: true, gameState };
  }

  async sitDown(
    roomId: string,
    telegramId: string,
    position: number,
    userData: UserDataDto,
  ): Promise<GameActionResult> {
    const gameState = await this.redisService.getGameState(roomId);
    if (!gameState) {
      return { success: false, error: 'Игра не найдена' };
    }

    if (gameState.players.some((p) => p.position === position)) {
      return { success: false, error: 'Это место уже занято' };
    }

    if (gameState.players.some((p) => p.id === telegramId)) {
      return { success: false, error: 'Вы уже сидите за столом' };
    }

    const userProfile = await this.usersService.getProfile(telegramId);
    const isGameInProgress = gameState.status !== 'waiting';
    const newPlayer = this.playerService.createPlayer(
      telegramId,
      userData,
      position,
      userProfile.balance,
      !isGameInProgress, // isActive is false if game is in progress
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

    const gameState = await this.redisService.getGameState(roomId);

    // Если игра перезапускается, отфильтровываем игроков, которые не могут позволить себе играть
    if (room.status === 'finished' && gameState) {
      const minBalance = room.minBet * 10;
      gameState.players = gameState.players.filter(
        (p) => p.balance >= minBalance,
      );
    }

    // Если после фильтрации (или из состояния ожидания) у нас недостаточно игроков, возвращаемся в режим ожидания
    if (!gameState || gameState.players.length < 2) {
      console.log(
        `Not enough players to start/continue game in room ${roomId}. Going to waiting state.`,
      );
      room.status = 'waiting';
      await this.redisService.setRoom(roomId, room);
      if (gameState) {
        const newGameState = this.gameStateService.createInitialGameState(
          roomId,
          room.minBet,
        );
        // Переносим оставшихся игроков в новое состояние
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

    // Теперь инициализируем новую игру. initializeNewGame будет использовать существующий (и отфильтрованный) массив игроков.
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
      console.log('🚫 startAntePhase skipped:', {
        roomId,
        hasGameState: !!gameState,
        status: gameState?.status,
      });
      return;
    }

    console.log('🎯 startAntePhase started:', {
      roomId,
      status: gameState.status,
      playersCount: gameState.players.length,
      activePlayersCount: gameState.players.filter((p) => p.isActive).length,
    });

    const { updatedGameState, actions } = this.bettingService.processAnte(
      gameState,
      gameState.minBet,
    );
    gameState = updatedGameState;
    gameState.log.push(...actions);

    const activePlayers = gameState.players.filter((p) => p.isActive);
    if (activePlayers.length < 2) {
      if (activePlayers.length === 1) {
        await this.endGameWithWinner(roomId, activePlayers[0].id);
      } else {
        await this.endGame(roomId);
      }
      return;
    }

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

    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);
  }

  // Новая логика свары
  private svaraTimers: Map<string, NodeJS.Timeout> = new Map();

  async joinSvara(
    roomId: string,
    telegramId: string,
  ): Promise<GameActionResult> {
    const gameState = await this.redisService.getGameState(roomId);
    if (!gameState || gameState.status !== 'svara_pending') {
      return { success: false, error: 'Сейчас нельзя присоединиться к сваре' };
    }

    // Проверяем, не принимал ли игрок уже решение
    if (
      gameState.svaraConfirmed?.includes(telegramId) ||
      gameState.svaraDeclined?.includes(telegramId)
    ) {
      console.log(
        `Player ${telegramId} has already made a decision for svara.`,
      );
      return { success: true, gameState }; // Просто возвращаем успех
    }

    const player = gameState.players.find((p) => p.id === telegramId);
    if (!player) {
      return { success: false, error: 'Игрок не найден' };
    }

    // Проверяем, является ли игрок изначальным участником свары (победителем)
    const isOriginalWinner =
      gameState.svaraParticipants &&
      gameState.svaraParticipants.includes(telegramId);

    if (isOriginalWinner) {
      // Изначальные победители участвуют бесплатно
      console.log(`Player ${telegramId} joins Svara as original winner (free)`);

      // Помечаем игрока как подтвердившего участие
      if (!gameState.svaraConfirmed) {
        gameState.svaraConfirmed = [];
      }
      if (!gameState.svaraConfirmed.includes(telegramId)) {
        gameState.svaraConfirmed.push(telegramId);
      }
    } else {
      // Обычные игроки должны доплатить сумму равную банку
      const svaraBuyInAmount = gameState.pot;
      if (player.balance < svaraBuyInAmount) {
        return {
          success: false,
          error: 'Недостаточно средств для входа в свару',
        };
      }

      // Списываем деньги и добавляем в банк
      player.balance -= svaraBuyInAmount;
      gameState.pot += svaraBuyInAmount;

      console.log(
        `Player ${telegramId} joins Svara with buy-in: ${svaraBuyInAmount}`,
      );

      // Добавляем игрока в список участников свары
      if (!gameState.svaraParticipants) {
        gameState.svaraParticipants = [];
      }
      gameState.svaraParticipants.push(telegramId);

      // Помечаем как подтвердившего участие
      if (!gameState.svaraConfirmed) {
        gameState.svaraConfirmed = [];
      }
      gameState.svaraConfirmed.push(telegramId);
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

    // Проверяем, не завершилась ли свара
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

    // Проверяем, не принимал ли игрок уже решение
    if (
      gameState.svaraConfirmed?.includes(telegramId) ||
      gameState.svaraDeclined?.includes(telegramId)
    ) {
      console.log(
        `Player ${telegramId} has already made a decision for svara.`,
      );
      return { success: true, gameState }; // Просто возвращаем успех
    }

    const player = gameState.players.find((p) => p.id === telegramId);
    if (!player) {
      return { success: false, error: 'Игрок не найден' };
    }

    // Помечаем, что игрок отказался
    if (!gameState.svaraDeclined) {
      gameState.svaraDeclined = [];
    }
    if (!gameState.svaraDeclined.includes(telegramId)) {
      gameState.svaraDeclined.push(telegramId);
    }

    const action: GameAction = {
      type: 'fold', // Используем fold для простоты, можно создать и новый тип
      telegramId,
      timestamp: Date.now(),
      message: `Игрок ${player.username} решил пропустить свару`,
    };
    gameState.log.push(action);

    // Отправляем обновление, чтобы клиент мог отреагировать (например, закрыть окно)
    await this.redisService.publishGameUpdate(roomId, gameState);

    // Проверяем, не завершилась ли свара
    await this._checkSvaraCompletion(roomId, gameState);

    return { success: true, gameState };
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

    const gameState = await this.redisService.getGameState(roomId);
    if (!gameState) {
      return { success: false, error: 'Игра не найдена' };
    }

    const playerIndex = gameState.players.findIndex((p) => p.id === telegramId);
    const player = gameState.players[playerIndex];

    // Если игрок посмотрел карты, он может только сбросить или повысить
    if (player.hasLookedAndMustAct && !['fold', 'raise'].includes(action)) {
      return {
        success: false,
        error:
          'После просмотра карт вы можете только повысить или сбросить карты',
      };
    }

    if (gameState.currentPlayerIndex !== playerIndex) {
      return { success: false, error: 'Сейчас не ваш ход' };
    }

    const { canPerform, error } = this.bettingService.canPerformAction(
      gameState.players[playerIndex],
      action,
      gameState,
    );
    if (!canPerform) {
      return { success: false, error };
    }

    switch (action) {
      case 'fold':
        return this.handleFold(roomId, gameState, playerIndex);
      case 'blind_bet':
      case 'look':
        return this.processBlindBettingAction(
          roomId,
          gameState,
          playerIndex,
          action,
        );
      case 'call':
      case 'raise':
        return this.processBettingAction(
          roomId,
          gameState,
          playerIndex,
          action,
          amount,
        );
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
        isActive: false,
        lastAction: 'fold',
        hasLookedAndMustAct: false,
      },
    );

    const foldAction: GameAction = {
      type: 'fold',
      telegramId: player.id,
      timestamp: Date.now(),
      message: `Игрок ${player.username} сбросил карты`,
    };
    gameState.log.push(foldAction);

    // Сохраняем баланс игрока в БД при сбросе карт
    try {
      await this.usersService.updatePlayerBalance(player.id, player.balance);
      console.log(
        `Player ${player.id} folded - balance saved to DB: ${player.balance}`,
      );

      // Отправляем обновление баланса игроку
      await this.redisService.publishBalanceUpdate(player.id, player.balance);
    } catch (error) {
      console.error(
        `Failed to save balance to DB for folded player ${player.id}:`,
        error,
      );
    }

    const activePlayers = gameState.players.filter(
      (p) => p.isActive && !p.hasFolded,
    );

    if (activePlayers.length === 1) {
      // Немедленно сохраняем состояние, где игрок сбросил карты
      await this.redisService.setGameState(roomId, gameState);
      await this.redisService.publishGameUpdate(roomId, gameState);
      // Затем запускаем процесс завершения игры
      await this.endGameWithWinner(roomId, activePlayers[0].id);
      return { success: true };
    } else {
      gameState.currentPlayerIndex = this.playerService.findNextActivePlayer(
        gameState.players,
        gameState.currentPlayerIndex,
      );
      if (this.bettingService.isBettingRoundComplete(gameState)) {
        await this.endBettingRound(roomId, gameState);
        return { success: true };
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
        // Устанавливаем lastAction для отображения уведомления
        gameState.players[playerIndex] = this.playerService.updatePlayerStatus(
          updatedPlayer,
          { lastAction: 'blind' },
        );
        gameState.pot = Number((gameState.pot + blindBetAmount).toFixed(2));
        gameState.lastBlindBet = blindBetAmount;
        gameState.lastBlindBettorIndex = playerIndex; // Set the index of the blind bettor
        gameState.log.push(blindAction);
        // Устанавливаем состояние анимации
        gameState.isAnimating = true;
        gameState.animationType = 'chip_fly';

        // Сохраняем состояние с анимацией
        await this.redisService.setGameState(roomId, gameState);
        await this.redisService.publishGameUpdate(roomId, gameState);

        // Ждем 1 секунду для анимации
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Снимаем состояние анимации
        gameState.isAnimating = false;
        gameState.animationType = undefined;

        gameState.currentPlayerIndex = this.playerService.findNextActivePlayer(
          gameState.players,
          gameState.currentPlayerIndex,
        );
        break;
      }
      case 'look': {
        const calculatedScore = this.cardService.calculateScore(player.cards);

        // Игрок просто смотрит свои карты. Это бесплатно и не передает ход.
        gameState.players[playerIndex] = this.playerService.updatePlayerStatus(
          player,
          {
            hasLooked: true,
            lastAction: 'look',
            hasLookedAndMustAct: true, // Устанавливаем флаг, что игрок должен действовать
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

        // Ход не передается, игрок должен выбрать следующее действие (fold или raise)
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
        gameState.pot = Number((gameState.pot + callAmount).toFixed(2));
        gameState.lastActionAmount = callAmount;
        gameState.log.push(callAction);
        break;
      }
      case 'raise': {
        const raiseAmount = amount || 0;
        const isPostLookRaise = player.hasLookedAndMustAct;

        // Определяем минимальную ставку для повышения
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
          { hasLookedAndMustAct: false }, // Сбрасываем флаг после действия
        );
        gameState.pot = Number((gameState.pot + raiseAmount).toFixed(2));
        gameState.lastRaiseIndex = playerIndex;
        gameState.lastActionAmount = raiseAmount;
        gameState.log.push(raiseAction);

        // Если это повышение после просмотра карт, переводим игру в фазу betting
        if (isPostLookRaise) {
          const phaseResult = this.gameStateService.moveToNextPhase(
            gameState,
            'betting',
          );
          gameState = phaseResult.updatedGameState;
          gameState.log.push(...phaseResult.actions);

          // Все остальные игроки смотрят карты
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

          // Вычисляем очки для всех игроков
          const scoreResult =
            this.gameStateService.calculateScoresForPlayers(gameState);
          gameState = scoreResult.updatedGameState;
          gameState.log.push(...scoreResult.actions);
        }
        break;
      }
    }

    // Устанавливаем состояние анимации
    gameState.isAnimating = true;
    gameState.animationType = 'chip_fly';

    // Сохраняем состояние с анимацией
    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);

    // Ждем 1 секунду для анимации
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Снимаем состояние анимации
    gameState.isAnimating = false;
    gameState.animationType = undefined;

    gameState.currentPlayerIndex = this.playerService.findNextActivePlayer(
      gameState.players,
      gameState.currentPlayerIndex,
    );
    if (this.bettingService.isBettingRoundComplete(gameState)) {
      await this.endBettingRound(roomId, gameState);
    } else {
      await this.redisService.setGameState(roomId, gameState);
      await this.redisService.publishGameUpdate(roomId, gameState);
    }
    return { success: true, gameState };
  }

  private async endBettingRound(
    roomId: string,
    gameState: GameState,
  ): Promise<void> {
    const phaseResult = this.gameStateService.moveToNextPhase(
      gameState,
      'showdown',
    );
    gameState = phaseResult.updatedGameState;
    gameState.log.push(...phaseResult.actions);

    // Проверяем, был ли кто-то повысивший ставку
    const wasRaise = gameState.lastRaiseIndex !== undefined;

    // Если никто не повышал ставки, дилер получает весь банк
    if (!wasRaise) {
      const dealer = gameState.players[gameState.dealerIndex];
      if (dealer && dealer.isActive && !dealer.hasFolded) {
        const potAmount = Number(gameState.pot.toFixed(2)); // Сохраняем значение банка с округлением
        dealer.balance += potAmount;
        gameState.pot = 0.0;

        const dealerWinAction: GameAction = {
          type: 'win',
          telegramId: dealer.id,
          amount: potAmount,
          timestamp: Date.now(),
          message: `Дилер получает весь банк (${potAmount}) - никто не повышал ставки`,
        };
        gameState.log.push(dealerWinAction);

        await this.redisService.setGameState(roomId, gameState);
        await this.redisService.publishGameUpdate(roomId, gameState);

        // Сохраняем баланс дилера в БД
        try {
          await this.usersService.updatePlayerBalance(
            dealer.id,
            dealer.balance,
          );
          await this.redisService.publishBalanceUpdate(
            dealer.id,
            dealer.balance,
          );
        } catch (error) {
          console.error(`Failed to save dealer balance to DB:`, error);
        }

        // Перезапускаем игру
        setTimeout(() => {
          this.startGame(roomId).catch((err) =>
            console.error(`Failed to auto-restart game ${roomId}`, err),
          );
        }, 5000);
        return;
      }
    }

    const scoreResult =
      this.gameStateService.calculateScoresForPlayers(gameState);
    gameState = scoreResult.updatedGameState;
    gameState.log.push(...scoreResult.actions);

    const winners = this.playerService.determineWinners(gameState.players);
    gameState.winners = winners;

    // Отладочный лог для проверки победителей
    console.log('🏆 Winners Debug:', {
      roomId,
      winnersCount: winners.length,
      winners: winners.map((w) => ({
        id: w.id,
        username: w.username,
        score: w.score,
      })),
      allPlayers: gameState.players.map((p) => ({
        id: p.id,
        username: p.username,
        score: p.score,
        isActive: p.isActive,
        hasFolded: p.hasFolded,
      })),
    });

    if (winners.length > 1) {
      console.log(
        '🔥 SVARA DETECTED! Starting Svara with winners:',
        winners.map((w) => ({
          id: w.id,
          username: w.username,
          score: w.score,
        })),
      );

      // Новая логика для обработки свары
      const phaseResult = this.gameStateService.moveToNextPhase(
        gameState,
        'svara_pending',
      );
      gameState = phaseResult.updatedGameState;
      gameState.log.push(...phaseResult.actions);

      gameState.isSvara = true;
      gameState.svaraParticipants = winners.map((w) => w.id);
      gameState.winners = winners;
      // Инициализируем массивы для отслеживания решений
      gameState.svaraConfirmed = [];
      gameState.svaraDeclined = [];

      const svaraAction: GameAction = {
        type: 'svara',
        telegramId: 'system',
        timestamp: Date.now(),
        message:
          'Объявлена "Свара"! Игроки могут присоединиться в течение 20 секунд.',
      };
      gameState.log.push(svaraAction);

      await this.redisService.setGameState(roomId, gameState);
      await this.redisService.publishGameUpdate(roomId, gameState);

      // Устанавливаем таймер для завершения свары
      const timer = setTimeout(() => {
        this.resolveSvara(roomId).catch((error) => {
          console.error(`Error resolving svara for room ${roomId}:`, error);
        });
      }, TURN_DURATION_SECONDS * 1000); // 20 секунд
      this.svaraTimers.set(roomId, timer);
    } else if (winners.length === 1) {
      await this.endGameWithWinner(roomId, winners[0].id);
    } else {
      await this.endGame(roomId);
    }
  }

  private async _checkSvaraCompletion(
    roomId: string,
    gameState: GameState,
  ): Promise<void> {
    const participantsCount = gameState.svaraParticipants?.length || 0;
    const decisionsCount =
      (gameState.svaraConfirmed?.length || 0) +
      (gameState.svaraDeclined?.length || 0);

    if (participantsCount > 0 && decisionsCount >= participantsCount) {
      console.log(
        `All svara participants have made a decision for room ${roomId}. Resolving svara immediately.`,
      );
      // Немедленно разрешаем свару, так как все приняли решение
      await this.resolveSvara(roomId);
    }
  }

  private async resolveSvara(roomId: string): Promise<void> {
    // Очищаем таймер
    if (this.svaraTimers.has(roomId)) {
      clearTimeout(this.svaraTimers.get(roomId));
      this.svaraTimers.delete(roomId);
    }

    const gameState = await this.redisService.getGameState(roomId);
    if (!gameState || gameState.status !== 'svara_pending') {
      return; // Игра уже не в состоянии ожидания свары
    }

    const participants = gameState.svaraParticipants;

    if (participants && participants.length >= 2) {
      // Если есть как минимум 2 участника, начинаем свару
      await this.startSvaraGame(roomId, participants);
    } else if (participants && participants.length === 1) {
      // Если только один участник (остальные не присоединились), он забирает банк
      await this.endGameWithWinner(roomId, participants[0]);
    } else {
      // Если участников нет (маловероятно, но возможно), просто завершаем игру
      await this.endGame(roomId);
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

    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);
  }

  private async endGameWithWinner(
    roomId: string,
    winnerId: string,
  ): Promise<void> {
    let gameState = await this.redisService.getGameState(roomId);
    if (!gameState) return;

    // Сохраняем значение банка для анимации
    const originalPot = gameState.pot;

    const { updatedGameState, actions } = this.bettingService.processWinnings(
      gameState,
      [winnerId],
    );
    gameState = updatedGameState;
    gameState.log.push(...actions);

    // Восстанавливаем значение банка для анимации
    gameState.pot = originalPot;

    const phaseResult = this.gameStateService.moveToNextPhase(
      gameState,
      'finished',
    );
    gameState = phaseResult.updatedGameState;
    gameState.log.push(...phaseResult.actions);

    // Устанавливаем флаг для показа анимации победы
    gameState.showWinnerAnimation = true;
    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);

    // Ждем 3 секунды для показа карт и анимации победы
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Запускаем анимацию фишек к победителю
    gameState.isAnimating = true;
    gameState.animationType = 'win_animation';
    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);

    // Ждем 3 секунды для анимации фишек
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Снимаем флаги анимации и обнуляем банк
    gameState.isAnimating = false;
    gameState.animationType = undefined;
    gameState.showWinnerAnimation = false;
    gameState.pot = 0.0; // Обнуляем банк после анимации
    // Сохраняем победителей для клиента
    const winnerPlayer = gameState.players.find((p) => p.id === winnerId);
    gameState.winners = winnerPlayer ? [winnerPlayer] : [];
    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);

    // Сохраняем балансы всех игроков в БД после завершения раунда
    try {
      const playersToUpdate = gameState.players.map((player) => ({
        telegramId: player.id,
        balance: player.balance,
      }));
      await this.usersService.updateMultiplePlayerBalances(playersToUpdate);
      console.log(
        `Game ${roomId} finished - balances saved to DB for ${playersToUpdate.length} players`,
      );

      // Отправляем обновление баланса всем игрокам
      for (const player of gameState.players) {
        await this.redisService.publishBalanceUpdate(player.id, player.balance);
      }
    } catch (error) {
      console.error(`Failed to save balances to DB for game ${roomId}:`, error);
    }

    const room = await this.redisService.getRoom(roomId);
    if (room) {
      room.status = 'finished';
      room.winner = winnerId;
      room.finishedAt = new Date();
      await this.redisService.setRoom(roomId, room);
      await this.redisService.publishRoomUpdate(roomId, room);
    }

    // Auto-restart game after 2 seconds
    setTimeout(() => {
      this.startGame(roomId).catch((err) =>
        console.error(`Failed to auto-restart game ${roomId}`, err),
      );
    }, 2000);
  }

  private async endGame(roomId: string): Promise<void> {
    let gameState = await this.redisService.getGameState(roomId);
    if (!gameState) return;

    const phaseResult = this.gameStateService.moveToNextPhase(
      gameState,
      'finished',
    );
    gameState = phaseResult.updatedGameState;
    gameState.log.push(...phaseResult.actions);

    const action: GameAction = {
      type: 'join',
      telegramId: 'system',
      timestamp: Date.now(),
      message: 'Игра завершена без победителя',
    };
    gameState.log.push(action);

    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);

    const room = await this.redisService.getRoom(roomId);
    if (room) {
      room.status = 'finished';
      room.finishedAt = new Date();
      await this.redisService.setRoom(roomId, room);
      await this.redisService.publishRoomUpdate(roomId, room);
    }

    // Auto-restart game after 5 seconds
    setTimeout(() => {
      this.startGame(roomId).catch((err) =>
        console.error(`Failed to auto-restart game ${roomId}`, err),
      );
    }, 5000);
  }
}
