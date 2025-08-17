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
      }
      if (gameState.players.length === 0) {
        await this.redisService.removeRoom(roomId);
        await this.redisService.clearGameData(roomId);
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
    const newPlayer = this.playerService.createPlayer(
      telegramId,
      userData,
      position,
      userProfile.balance,
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
        await this.redisService.setGameState(roomId, gameState);
        await this.redisService.publishGameUpdate(roomId, gameState);
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
    if (!gameState || gameState.status !== 'ante') return;

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

    const playerIndex = gameState.players.findIndex((p) => p.id === telegramId);
    if (playerIndex === -1) {
      return { success: false, error: 'Игрок не найден' };
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
      { hasFolded: true, isActive: false, lastAction: 'fold' },
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
        gameState.players[playerIndex] = updatedPlayer;
        gameState.pot += blindBetAmount;
        gameState.lastBlindBet = blindBetAmount;
        gameState.lastBlindBettorIndex = playerIndex; // Set the index of the blind bettor
        gameState.log.push(blindAction);
        gameState.currentPlayerIndex = this.playerService.findNextActivePlayer(
          gameState.players,
          gameState.currentPlayerIndex,
        );
        break;
      }
      case 'look': {
        // Вычисляем обязательную ставку при просмотре карт
        const mandatoryBet =
          gameState.lastBlindBet > 0
            ? gameState.lastBlindBet * 2
            : gameState.minBet;

        // Проверяем, достаточно ли средств для обязательной ставки
        if (player.balance < mandatoryBet) {
          // Если недостаточно средств, игрок автоматически выбывает
          return this.handleFold(roomId, gameState, playerIndex);
        }

        // Списываем обязательную ставку с баланса игрока
        const { updatedPlayer, action: betAction } =
          this.playerService.processPlayerBet(player, mandatoryBet, 'call');
        gameState.players[playerIndex] = updatedPlayer;
        gameState.pot += mandatoryBet;
        gameState.log.push(betAction);

        // Отмечаем, что игрок посмотрел карты
        gameState.players[playerIndex] = this.playerService.updatePlayerStatus(
          gameState.players[playerIndex],
          { hasLooked: true, lastAction: 'look' },
        );
        const lookAction: GameAction = {
          type: 'look',
          telegramId: player.id,
          timestamp: Date.now(),
          message: `Игрок ${player.username} посмотрел карты`,
        };
        gameState.log.push(lookAction);

        // Переходим в фазу betting
        const phaseResult = this.gameStateService.moveToNextPhase(
          gameState,
          'betting',
        );
        gameState = phaseResult.updatedGameState;
        gameState.log.push(...phaseResult.actions);

        // Устанавливаем текущую ставку для фазы betting
        gameState.currentBet = mandatoryBet;
        // Устанавливаем последнего повысившего как текущего игрока
        gameState.lastRaiseIndex = playerIndex;

        // Все игроки автоматически смотрят карты при переходе в betting
        for (let i = 0; i < gameState.players.length; i++) {
          if (
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

        // Переходим к следующему игроку (важно: ход переходит к следующему!)
        gameState.currentPlayerIndex = this.playerService.findNextActivePlayer(
          gameState.players,
          playerIndex,
        );

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
        const callAmount = gameState.currentBet - player.currentBet;
        if (player.balance < callAmount) {
          return { success: false, error: 'Недостаточно средств' };
        }
        const { updatedPlayer, action: callAction } =
          this.playerService.processPlayerBet(player, callAmount, 'call');
        gameState.players[playerIndex] = updatedPlayer;
        gameState.pot += callAmount;
        gameState.log.push(callAction);
        break;
      }
      case 'raise': {
        if (!amount || amount <= gameState.currentBet) {
          return {
            success: false,
            error: `Повышение должно быть больше текущей ставки ${gameState.currentBet}`,
          };
        }
        const raiseAmount = amount - player.currentBet;
        if (player.balance < raiseAmount) {
          return { success: false, error: 'Недостаточно средств' };
        }
        const { updatedPlayer, action: raiseAction } =
          this.playerService.processPlayerBet(player, raiseAmount, 'raise');
        gameState.players[playerIndex] = updatedPlayer;
        gameState.pot += raiseAmount;
        gameState.currentBet = amount;
        gameState.lastRaiseIndex = playerIndex;
        gameState.log.push(raiseAction);
        break;
      }
    }

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
        const potAmount = gameState.pot; // Сохраняем значение банка
        dealer.balance += potAmount;
        gameState.pot = 0;

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

    if (winners.length > 1) {
      gameState.isSvara = true;
      const svaraAction: GameAction = {
        type: 'svara',
        telegramId: 'system',
        timestamp: Date.now(),
        message: 'Объявлена "Свара"!',
      };
      gameState.log.push(svaraAction);
      await this.redisService.setGameState(roomId, gameState);
      await this.redisService.publishGameUpdate(roomId, gameState);
      await this.startSvaraGame(
        roomId,
        winners.map((w) => w.id),
      );
    } else if (winners.length === 1) {
      await this.endGameWithWinner(roomId, winners[0].id);
    } else {
      await this.endGame(roomId);
    }
  }

  private async startSvaraGame(
    roomId: string,
    winnerIds: string[],
  ): Promise<void> {
    let gameState = await this.redisService.getGameState(roomId);
    if (!gameState) return;

    const { updatedGameState, actions } =
      this.gameStateService.initializeSvaraGame(gameState, winnerIds);
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

    const { updatedGameState, actions } = this.bettingService.processWinnings(
      gameState,
      [winnerId],
    );
    gameState = updatedGameState;
    gameState.log.push(...actions);

    const phaseResult = this.gameStateService.moveToNextPhase(
      gameState,
      'finished',
    );
    gameState = phaseResult.updatedGameState;
    gameState.log.push(...phaseResult.actions);

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

    // Auto-restart game after 5 seconds
    setTimeout(() => {
      this.startGame(roomId).catch((err) =>
        console.error(`Failed to auto-restart game ${roomId}`, err),
      );
    }, 5000);
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
