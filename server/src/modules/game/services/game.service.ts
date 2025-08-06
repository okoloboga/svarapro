import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../services/redis.service';
import { GameState, GameAction, GameActionResult } from '../../../types/game';
import { CardService } from './card.service';
import { PlayerService } from './player.service';
import { BettingService } from './betting.service';
import { GameStateService } from './game-state.service';
import { UsersService } from '../../users/users.service';
import { Room } from '../../../types/game';

@Injectable()
export class GameService {
  constructor(
    private readonly redisService: RedisService,
    private readonly cardService: CardService,
    private readonly playerService: PlayerService,
    private readonly bettingService: BettingService,
    private readonly gameStateService: GameStateService,
    private readonly usersService: UsersService,
  ) {}

  // Получение списка комнат
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

  // Покинуть комнату
  async leaveRoom(roomId: string, telegramId: string): Promise<void> {
    const room = await this.redisService.getRoom(roomId);
    if (!room) return;

    // Удаляем игрока из списка игроков
    room.players = room.players.filter((playerId) => playerId !== telegramId);

    // Если комната пуста, удаляем ее
    if (room.players.length === 0) {
      await this.redisService.removeRoom(roomId);
      await this.redisService.clearGameData(roomId);
    } else {
      // Обновляем комнату
      await this.redisService.setRoom(roomId, room);
      await this.redisService.publishRoomUpdate(roomId, room);

      // Если игра уже идет, обновляем состояние игры
      if (room.status === 'playing') {
        await this.markPlayerInactive(roomId, telegramId);
      }
    }

    // Удаляем связь игрока с комнатой
    await this.redisService.removePlayerFromRoom(roomId, telegramId);
  }

  // Присоединиться к игре
  async joinGame(
    roomId: string,
    telegramId: string,
    userData: any,
  ): Promise<GameActionResult> {
    const room = await this.redisService.getRoom(roomId);
    if (!room) {
      return { success: false, error: 'Комната не найдена' };
    }

    // Проверяем, не заполнена ли комната
    if (room.players.length >= room.maxPlayers) {
      return { success: false, error: 'Комната заполнена' };
    }

    // Проверяем, не находится ли игрок уже в комнате
    if (room.players.includes(telegramId)) {
      // Игрок уже в комнате, возвращаем текущее состояние
      const gameState = await this.redisService.getGameState(roomId);
      return { success: true, gameState };
    }

    // Добавляем игрока в комнату
    room.players.push(telegramId);
    await this.redisService.setRoom(roomId, room);
    await this.redisService.addPlayerToRoom(roomId, telegramId);
    await this.redisService.publishRoomUpdate(roomId, room);

    // Если игра еще не началась, создаем или обновляем состояние игры
    let gameState = await this.redisService.getGameState(roomId);
    if (!gameState) {
      // Создаем новое состояние игры
      gameState = this.gameStateService.createInitialGameState(
        roomId,
        room.minBet,
      );
    }

    // Добавляем игрока в состояние игры
    const newPlayer = this.playerService.createPlayer(
      telegramId,
      userData,
      gameState.players.length,
    );
    gameState.players.push(newPlayer);

    // Добавляем действие в лог
    const action: GameAction = {
      type: 'join',
      telegramId: telegramId,
      timestamp: Date.now(),
      message: `Игрок ${newPlayer.username} присоединился к игре`,
    };
    gameState.log.push(action);

    // Сохраняем обновленное состояние
    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);

    // Если достаточно игроков и игра еще не началась, начинаем игру
    if (room.players.length >= 2 && room.status === 'waiting') {
      await this.startGame(roomId);
    }

    return { success: true, gameState };
  }

  // Обработка действия "сесть за стол"
  async sitDown(
    roomId: string,
    telegramId: string,
    position: number,
  ): Promise<GameActionResult> {
    const gameState = await this.redisService.getGameState(roomId);
    if (!gameState) {
      return { success: false, error: 'Игра не найдена' };
    }

    // Проверяем, не занята ли позиция
    const positionTaken = gameState.players.some(
      (p) => p.position === position,
    );
    if (positionTaken) {
      return { success: false, error: 'Это место уже занято' };
    }

    // Проверяем, не сидит ли игрок уже за столом
    const playerAlreadySeated = gameState.players.some(
      (p) => p.id === telegramId,
    );
    if (playerAlreadySeated) {
      return { success: false, error: 'Вы уже сидите за столом' };
    }

    // Получаем данные пользователя
    const userData = await this.getUserData(telegramId);
    if (!userData) {
      return {
        success: false,
        error: 'Не удалось получить данные пользователя',
      };
    }

    // Создаем нового игрока
    const newPlayer = this.playerService.createPlayer(
      telegramId,
      userData,
      position,
    );
    gameState.players.push(newPlayer);

    // Добавляем действие в лог
    const action: GameAction = {
      type: 'join',
      telegramId: telegramId,
      timestamp: Date.now(),
      message: `Игрок ${newPlayer.username} сел за стол на позицию ${position + 1}`,
    };
    gameState.log.push(action);

    // Сохраняем обновленное состояние
    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);

    // Если достаточно игроков и игра еще не началась, начинаем игру
    const room = await this.redisService.getRoom(roomId);
    if (room && gameState.players.length >= 2 && room.status === 'waiting') {
      await this.startGame(roomId);
    }

    return { success: true, gameState };
  }

  // Начало игры
  async startGame(roomId: string): Promise<void> {
    const room = await this.redisService.getRoom(roomId);
    if (!room || room.status !== 'waiting' || room.players.length < 2) {
      return;
    }

    // Обновляем статус комнаты
    room.status = 'playing';
    await this.redisService.setRoom(roomId, room);
    await this.redisService.publishRoomUpdate(roomId, room);

    // Получаем состояние игры
    let gameState = await this.redisService.getGameState(roomId);
    if (!gameState) {
      gameState = this.gameStateService.createInitialGameState(
        roomId,
        room.minBet,
      );
    }

    // Инициализируем игру
    const { updatedGameState, actions } =
      this.gameStateService.initializeNewGame(gameState);
    gameState = updatedGameState;
    gameState.log.push(...actions);

    // Сохраняем обновленное состояние
    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);

    // Начинаем фазу анте (входных ставок)
    await this.startAntePhase(roomId);
  }

  // Начало фазы анте (входных ставок)
  async startAntePhase(roomId: string): Promise<void> {
    const gameState = await this.redisService.getGameState(roomId);
    if (!gameState || gameState.status !== 'ante') {
      return;
    }

    // Обрабатываем анте
    const { updatedGameState, actions } = this.bettingService.processAnte(
      gameState,
      gameState.minBet,
    );
    gameState.log.push(...actions);

    // Проверяем, остались ли активные игроки
    const activePlayers = gameState.players.filter((p) => p.isActive);
    if (activePlayers.length < 2) {
      // Недостаточно игроков для продолжения
      if (activePlayers.length === 1) {
        // Один игрок выигрывает банк
        await this.endGameWithWinner(roomId, activePlayers[0].id);
      } else {
        // Нет активных игроков, завершаем игру
        await this.endGame(roomId);
      }
      return;
    }

    // Раздаем карты
    const dealResult =
      this.gameStateService.dealCardsToPlayers(updatedGameState);
    gameState.log.push(...dealResult.actions);

    // Переходим к фазе ставок вслепую
    const phaseResult = this.gameStateService.moveToNextPhase(
      dealResult.updatedGameState,
      'blind_betting',
    );
    gameState.log.push(...phaseResult.actions);

    // Устанавливаем текущего игрока (следующий после дилера)
    gameState.currentPlayerIndex = this.playerService.findNextActivePlayer(
      gameState.players,
      gameState.dealerIndex,
    );

    // Сохраняем обновленное состояние
    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);
  }

  // Обработка действия игрока
  async processAction(
    roomId: string,
    telegramId: string,
    action: string,
    amount?: number,
  ): Promise<GameActionResult> {
    const gameState = await this.redisService.getGameState(roomId);
    if (!gameState) {
      return { success: false, error: 'Игра не найдена' };
    }

    // Находим игрока
    const playerIndex = gameState.players.findIndex((p) => p.id === telegramId);
    if (playerIndex === -1) {
      return { success: false, error: 'Игрок не найден' };
    }

    const player = gameState.players[playerIndex];

    // Проверяем, чей сейчас ход
    if (gameState.currentPlayerIndex !== playerIndex) {
      return { success: false, error: 'Сейчас не ваш ход' };
    }

    // Проверяем возможность действия
    const { canPerform, error } = this.bettingService.canPerformAction(
      player,
      action,
      gameState,
    );

    if (!canPerform) {
      return { success: false, error };
    }

    // Обрабатываем действие в зависимости от фазы игры
    switch (gameState.status) {
      case 'blind_betting':
        return await this.processBlindBettingAction(
          roomId,
          gameState,
          playerIndex,
          action,
          amount,
        );
      case 'betting':
        return await this.processBettingAction(
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

  // Получение данных пользователя (заглушка, реализуйте в соответствии с вашей логикой)
  private async getUserData(telegramId: string): Promise<any> {
    try {
      const user = await this.usersService.getProfile(telegramId);
      return {
        username: user.username,
        avatar: user.avatar,
        balance: user.balance,
      };
    } catch (error) {
      // Обработка ошибок, например, если пользователь не найден
      console.error(
        `Failed to get user data for telegramId: ${telegramId}`,
        error,
      );
      return null;
    }
  }

  // Обработка действия в фазе ставок вслепую
  private async processBlindBettingAction(
    roomId: string,
    gameState: GameState,
    playerIndex: number,
    action: string,
    amount?: number,
  ): Promise<GameActionResult> {
    const player = gameState.players[playerIndex];

    switch (action) {
      case 'blind_bet': {
        // Проверяем, что ставка корректна
        if (!amount || amount < gameState.lastBlindBet * 2) {
          return {
            success: false,
            error: `Минимальная ставка вслепую: ${
              gameState.lastBlindBet * 2 || gameState.minBet
            }`,
          };
        }

        // Проверяем, достаточно ли у игрока баланса
        if (player.balance < amount) {
          return { success: false, error: 'Недостаточно средств' };
        }

        // Делаем ставку
        const { updatedPlayer, action: blindAction } =
          this.playerService.processPlayerBet(player, amount, 'blind_bet');

        gameState.players[playerIndex] = updatedPlayer;
        gameState.pot += amount;
        gameState.lastBlindBet = amount;
        gameState.log.push(blindAction);

        // Переходим к следующему игроку
        gameState.currentPlayerIndex = this.playerService.findNextActivePlayer(
          gameState.players,
          gameState.currentPlayerIndex,
        );
        break;
      }
      case 'look': {
        // Игрок решил посмотреть карты
        gameState.players[playerIndex] = this.playerService.updatePlayerStatus(
          player,
          { hasLooked: true, lastAction: 'look' },
        );

        // Добавляем действие в лог
        const lookAction: GameAction = {
          type: 'look',
          telegramId: player.id,
          timestamp: Date.now(),
          message: `Игрок ${player.username} посмотрел карты`,
        };
        gameState.log.push(lookAction);

        // Переходим к фазе обычных ставок
        const phaseResult = this.gameStateService.moveToNextPhase(
          gameState,
          'betting',
        );
        gameState.log.push(...phaseResult.actions);

        // Если была ставка вслепую, игрок должен сделать ставку
        if (gameState.lastBlindBet > 0) {
          // Проверяем, достаточно ли у игрока баланса
          const requiredBet = gameState.lastBlindBet * 2;
          if (player.balance < requiredBet) {
            gameState.players[playerIndex] =
              this.playerService.updatePlayerStatus(
                gameState.players[playerIndex],
                { hasFolded: true, isActive: false, lastAction: 'fold' },
              );

            // Добавляем действие в лог
            const foldAction: GameAction = {
              type: 'fold',
              telegramId: player.id,
              timestamp: Date.now(),
              message: `Игрок ${player.username} сбросил карты (недостаточно средств)`,
            };
            gameState.log.push(foldAction);

            // Переходим к следующему игроку
            gameState.currentPlayerIndex =
              this.playerService.findNextActivePlayer(
                gameState.players,
                gameState.currentPlayerIndex,
              );
          }
        }
        break;
      }
      case 'fold': {
        // Игрок сбрасывает карты
        gameState.players[playerIndex] = this.playerService.updatePlayerStatus(
          player,
          { hasFolded: true, isActive: false, lastAction: 'fold' },
        );

        // Добавляем действие в лог
        const foldAction: GameAction = {
          type: 'fold',
          telegramId: player.id,
          timestamp: Date.now(),
          message: `Игрок ${player.username} сбросил карты`,
        };
        gameState.log.push(foldAction);

        // Проверяем, остался ли только один активный игрок
        const activePlayers = gameState.players.filter(
          (p) => p.isActive && !p.hasFolded,
        );
        if (activePlayers.length === 1) {
          // Завершаем игру с победой последнего активного игрока
          await this.endGameWithWinner(roomId, activePlayers[0].id);
          return { success: true };
        }

        // Переходим к следующему игроку
        gameState.currentPlayerIndex = this.playerService.findNextActivePlayer(
          gameState.players,
          gameState.currentPlayerIndex,
        );
        break;
      }
      default:
        return { success: false, error: 'Недопустимое действие' };
    }

    // Сохраняем обновленное состояние
    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);

    return { success: true, gameState };
  }

  // Обработка действия в фазе обычных ставок
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
        // Игрок уравнивает текущую ставку
        const callAmount = gameState.currentBet - player.currentBet;

        // Проверяем, достаточно ли у игрока баланса
        if (player.balance < callAmount) {
          return { success: false, error: 'Недостаточно средств' };
        }

        // Уравниваем ставку
        const { updatedPlayer: callPlayer, action: callAction } =
          this.playerService.processPlayerBet(player, callAmount, 'call');

        gameState.players[playerIndex] = callPlayer;
        gameState.pot += callAmount;
        gameState.log.push(callAction);

        // Переходим к следующему игроку
        gameState.currentPlayerIndex = this.playerService.findNextActivePlayer(
          gameState.players,
          gameState.currentPlayerIndex,
        );

        // Проверяем, завершился ли круг ставок
        if (this.bettingService.isBettingRoundComplete(gameState)) {
          await this.endBettingRound(roomId, gameState);
          return { success: true };
        }
        break;
      }
      case 'raise': {
        // Игрок повышает ставку
        if (!amount || amount <= gameState.currentBet) {
          return {
            success: false,
            error: `Повышение должно быть больше текущей ставки ${gameState.currentBet}`,
          };
        }

        // Вычисляем сумму для добавления
        const raiseTotal = amount;
        const raiseAmount = raiseTotal - player.currentBet;

        // Проверяем, достаточно ли у игрока баланса
        if (player.balance < raiseAmount) {
          return { success: false, error: 'Недостаточно средств' };
        }

        // Повышаем ставку
        const { updatedPlayer: raisePlayer, action: raiseAction } =
          this.playerService.processPlayerBet(player, raiseAmount, 'raise');

        gameState.players[playerIndex] = raisePlayer;
        gameState.pot += raiseAmount;
        gameState.currentBet = raiseTotal;
        gameState.lastRaiseIndex = playerIndex;
        gameState.log.push(raiseAction);

        // Переходим к следующему игроку
        gameState.currentPlayerIndex = this.playerService.findNextActivePlayer(
          gameState.players,
          gameState.currentPlayerIndex,
        );
        break;
      }
      case 'fold': {
        // Игрок сбрасывает карты
        gameState.players[playerIndex] = this.playerService.updatePlayerStatus(
          player,
          { hasFolded: true, isActive: false, lastAction: 'fold' },
        );

        // Добавляем действие в лог
        const foldAction: GameAction = {
          type: 'fold',
          telegramId: player.id,
          timestamp: Date.now(),
          message: `Игрок ${player.username} сбросил карты`,
        };
        gameState.log.push(foldAction);

        // Проверяем, остался ли только один активный игрок
        const activePlayers = gameState.players.filter(
          (p) => p.isActive && !p.hasFolded,
        );
        if (activePlayers.length === 1) {
          // Завершаем игру с победой последнего активного игрока
          await this.endGameWithWinner(roomId, activePlayers[0].id);
          return { success: true };
        }

        // Переходим к следующему игроку
        gameState.currentPlayerIndex = this.playerService.findNextActivePlayer(
          gameState.players,
          gameState.currentPlayerIndex,
        );

        // Проверяем, завершился ли круг ставок
        if (this.bettingService.isBettingRoundComplete(gameState)) {
          await this.endBettingRound(roomId, gameState);
          return { success: true };
        }
        break;
      }
      default:
        return { success: false, error: 'Недопустимое действие' };
    }

    // Сохраняем обновленное состояние
    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);

    return { success: true, gameState };
  }

  // Завершение круга ставок
  private async endBettingRound(
    roomId: string,
    gameState: GameState,
  ): Promise<void> {
    // Переходим к вскрытию карт
    const phaseResult = this.gameStateService.moveToNextPhase(
      gameState,
      'showdown',
    );
    gameState.log.push(...phaseResult.actions);

    // Вычисляем очки для каждого активного игрока
    const scoreResult =
      this.gameStateService.calculateScoresForPlayers(gameState);
    gameState.log.push(...scoreResult.actions);

    // Определяем победителя(ей)
    const winners = this.playerService.determineWinners(gameState.players);
    gameState.winners = winners;

    // Если есть несколько победителей с одинаковым счетом, объявляем "свару"
    if (winners.length > 1) {
      gameState.isSvara = true;

      // Добавляем действие в лог
      const svaraAction: GameAction = {
        type: 'svara',
        telegramId: 'system',
        timestamp: Date.now(),
        message: 'Объявлена "Свара"! Несколько игроков имеют одинаковый счет.',
      };
      gameState.log.push(svaraAction);

      // Сохраняем обновленное состояние
      await this.redisService.setGameState(roomId, gameState);
      await this.redisService.publishGameUpdate(roomId, gameState);

      // Начинаем новую игру для "свары"
      await this.startSvaraGame(
        roomId,
        winners.map((w) => w.id),
      );
    } else if (winners.length === 1) {
      // Один победитель, завершаем игру
      await this.endGameWithWinner(roomId, winners[0].id);
    } else {
      // Нет победителей (не должно происходить), завершаем игру
      await this.endGame(roomId);
    }
  }

  // Начало новой игры для "свары"
  private async startSvaraGame(
    roomId: string,
    winnerIds: string[],
  ): Promise<void> {
    // Получаем текущее состояние игры
    const gameState = await this.redisService.getGameState(roomId);
    if (!gameState) {
      return;
    }

    // Инициализируем игру для "свары"
    const { updatedGameState, actions } =
      this.gameStateService.initializeSvaraGame(gameState, winnerIds);

    // Обновляем лог
    updatedGameState.log.push(...actions);

    // Раздаем карты
    const dealResult =
      this.gameStateService.dealCardsToPlayers(updatedGameState);
    updatedGameState.log.push(...dealResult.actions);

    // Переходим к фазе ставок вслепую
    const phaseResult = this.gameStateService.moveToNextPhase(
      dealResult.updatedGameState,
      'blind_betting',
    );
    updatedGameState.log.push(...phaseResult.actions);

    // Устанавливаем текущего игрока (следующий после дилера)
    updatedGameState.currentPlayerIndex =
      this.playerService.findNextActivePlayer(
        updatedGameState.players,
        updatedGameState.dealerIndex,
      );

    // Сохраняем обновленное состояние
    await this.redisService.setGameState(roomId, updatedGameState);
    await this.redisService.publishGameUpdate(roomId, updatedGameState);
  }

  // Завершение игры с победителем
  private async endGameWithWinner(
    roomId: string,
    winnerId: string,
  ): Promise<void> {
    const gameState = await this.redisService.getGameState(roomId);
    if (!gameState) {
      return;
    }

    // Обрабатываем выигрыш
    const { updatedGameState, actions } = this.bettingService.processWinnings(
      gameState,
      [winnerId],
    );

    // Обновляем лог
    updatedGameState.log.push(...actions);

    // Переходим к завершению игры
    const phaseResult = this.gameStateService.moveToNextPhase(
      updatedGameState,
      'finished',
    );
    updatedGameState.log.push(...phaseResult.actions);

    // Сохраняем обновленное состояние
    await this.redisService.setGameState(roomId, updatedGameState);
    await this.redisService.publishGameUpdate(roomId, updatedGameState);

    // Обновляем комнату
    const room = await this.redisService.getRoom(roomId);
    if (room) {
      room.status = 'finished';
      room.winner = winnerId;
      room.finishedAt = new Date();

      await this.redisService.setRoom(roomId, room);
      await this.redisService.publishRoomUpdate(roomId, room);
    }
  }

  // Завершение игры без победителя
  private async endGame(roomId: string): Promise<void> {
    const gameState = await this.redisService.getGameState(roomId);
    if (!gameState) {
      return;
    }

    // Переходим к завершению игры
    const phaseResult = this.gameStateService.moveToNextPhase(
      gameState,
      'finished',
    );
    gameState.log.push(...phaseResult.actions);

    // Добавляем действие в лог
    const action: GameAction = {
      type: 'join',
      telegramId: 'system',
      timestamp: Date.now(),
      message: 'Игра завершена без победителя',
    };
    gameState.log.push(action);

    // Сохраняем обновленное состояние
    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);

    // Обновляем комнату
    const room = await this.redisService.getRoom(roomId);
    if (room) {
      room.status = 'finished';
      room.finishedAt = new Date();

      await this.redisService.setRoom(roomId, room);
      await this.redisService.publishRoomUpdate(roomId, room);
    }
  }

  // Пометить игрока как неактивного
  async markPlayerInactive(roomId: string, telegramId: string): Promise<void> {
    const gameState = await this.redisService.getGameState(roomId);
    if (!gameState) {
      return;
    }

    // Находим игрока
    const playerIndex = gameState.players.findIndex((p) => p.id === telegramId);
    if (playerIndex === -1) {
      return;
    }

    // Помечаем игрока как неактивного
    gameState.players[playerIndex] = this.playerService.updatePlayerStatus(
      gameState.players[playerIndex],
      { isActive: false, hasFolded: true },
    );

    // Добавляем действие в лог
    const action: GameAction = {
      type: 'leave',
      telegramId: telegramId,
      timestamp: Date.now(),
      message: `Игрок ${gameState.players[playerIndex].username} покинул игру`,
    };
    gameState.log.push(action);

    // Проверяем, остался ли только один активный игрок
    const activePlayers = gameState.players.filter(
      (p) => p.isActive && !p.hasFolded,
    );
    if (activePlayers.length === 1) {
      // Завершаем игру с победой последнего активного игрока
      await this.endGameWithWinner(roomId, activePlayers[0].id);
    } else if (activePlayers.length === 0) {
      // Завершаем игру без победителя
      await this.endGame(roomId);
    } else {
      // Если текущий ход был у покинувшего игрока, переходим к следующему
      if (gameState.currentPlayerIndex === playerIndex) {
        gameState.currentPlayerIndex = this.playerService.findNextActivePlayer(
          gameState.players,
          gameState.currentPlayerIndex,
        );
      }

      // Обновляем состояние игры
      await this.redisService.setGameState(roomId, gameState);
      await this.redisService.publishGameUpdate(roomId, gameState);
    }
  }

  // Получение состояния игры
  async getGameState(roomId: string): Promise<GameState | null> {
    return this.redisService.getGameState(roomId);
  }
}
