import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../services/redis.service';
import { GameState, GameAction, GameActionResult } from '../../../types/game';
import { CardService } from './card.service';
import { PlayerService } from './player.service';
import { BettingService } from './betting.service';
import { GameStateService } from './game-state.service';
import { UsersService } from '../../users/users.service';
import { Room } from '../../../types/game';
import { warn } from 'console';

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

  async getRooms(): Promise<Room[]> {
    console.log('Fetching active rooms');
    const roomIds = await this.redisService.getActiveRooms();
    const rooms: Room[] = [];

    for (const roomId of roomIds) {
      const room = await this.redisService.getRoom(roomId);
      if (room) {
        rooms.push(room);
      }
    }
    console.log('Rooms fetched:', rooms);
    return rooms;
  }

  async leaveRoom(roomId: string, telegramId: string): Promise<void> {
    console.log('Handling leaveRoom:', { roomId, telegramId });
    const room = await this.redisService.getRoom(roomId);
    if (!room) {
      console.log(`Room ${roomId} not found`);
      return;
    }

    // Remove from spectator list
    room.players = room.players.filter((playerId) => playerId !== telegramId);
    await this.redisService.setRoom(roomId, room);
    await this.redisService.publishRoomUpdate(roomId, room);

    const gameState = await this.redisService.getGameState(roomId);
    if (gameState) {
      const playerIndex = gameState.players.findIndex((p) => p.id === telegramId);

      if (playerIndex > -1) {
        // Player is seated, remove them
        const removedPlayer = gameState.players.splice(playerIndex, 1)[0];

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

      // Check if the room is now empty of seated players
      if (gameState.players.length === 0) {
        console.log(`Room ${roomId} is empty of players, removing`);
        await this.redisService.removeRoom(roomId);
        await this.redisService.clearGameData(roomId);
      }
    }

    await this.redisService.removePlayerFromRoom(roomId, telegramId);
  }

  async joinRoom(
    roomId: string,
    telegramId: string,
    userData: any,
  ): Promise<GameActionResult> {
    console.log('Handling joinRoom:', { roomId, telegramId, userData });
    const room = await this.redisService.getRoom(roomId);
    if (!room) {
      console.log(`Room ${roomId} not found`);
      return { success: false, error: 'Комната не найдена' };
    }

    if (!room.players.includes(telegramId)) {
      room.players.push(telegramId);
      await this.redisService.setRoom(roomId, room);
      await this.redisService.addPlayerToRoom(roomId, telegramId);
      await this.redisService.publishRoomUpdate(roomId, room);
    }

    const gameState = await this.redisService.getGameState(roomId);
    console.log(`Retrieved gameState from Redis for room ${roomId}:`, gameState);

    if (!gameState) {
        return { success: false, error: 'Игра не найдена' };
    }

    return { success: true, gameState };
  }

  async sitDown(
    roomId: string,
    telegramId: string,
    position: number,
  ): Promise<GameActionResult> {
    console.log('Handling sitDown:', { roomId, telegramId, position });
    const gameState = await this.redisService.getGameState(roomId);
    if (!gameState) {
      console.log(`Game state not found for room ${roomId}`);
      return { success: false, error: 'Игра не найдена' };
    }

    const positionTaken = gameState.players.some(
      (p) => p.position === position,
    );
    if (positionTaken) {
      console.log(`Position ${position} is already taken in room ${roomId}`);
      return { success: false, error: 'Это место уже занято' };
    }

    const playerAlreadySeated = gameState.players.some(
      (p) => p.id === telegramId,
    );
    if (playerAlreadySeated) {
      console.log(`Player ${telegramId} is already seated in room ${roomId}`);
      return { success: false, error: 'Вы уже сидите за столом' };
    }

    const userData = await this.getUserData(telegramId);
    if (!userData) {
      console.log(`Failed to get user data for ${telegramId}`);
      return {
        success: false,
        error: 'Не удалось получить данные пользователя',
      };
    }

    const newPlayer = this.playerService.createPlayer(
      telegramId,
      userData,
      position,
    );
    gameState.players.push(newPlayer);

    const action: GameAction = {
      type: 'join',
      telegramId,
      timestamp: Date.now(),
      message: `Игрок ${newPlayer.username} сел за стол на позицию ${position + 1}`,
    };
    gameState.log.push(action);

    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);
    console.log(`Player ${telegramId} seated at position ${position} in room ${roomId}`);

    const room = await this.redisService.getRoom(roomId);
    if (room && gameState.players.length >= 2 && room.status === 'waiting') {
      console.log(`Starting game for room ${roomId} after sitDown`);
      await this.startGame(roomId);
    }

    return { success: true, gameState };
  }

  async startGame(roomId: string): Promise<void> {
    console.log('Starting game for room:', roomId);
    const room = await this.redisService.getRoom(roomId);
    if (!room || room.status !== 'waiting' || room.players.length < 2) {
      console.log(`Cannot start game for room ${roomId}:`, { room, players: room?.players });
      return;
    }

    room.status = 'playing';
    await this.redisService.setRoom(roomId, room);
    await this.redisService.publishRoomUpdate(roomId, room);
    console.log(`Room ${roomId} status updated to playing`);

    let gameState = await this.redisService.getGameState(roomId);
    if (!gameState) {
      console.log(`Creating initial game state for room ${roomId}`);
      gameState = this.gameStateService.createInitialGameState(
        roomId,
        room.minBet,
      );
    }

    const { updatedGameState, actions } =
      this.gameStateService.initializeNewGame(gameState);
    gameState = updatedGameState;
    gameState.log.push(...actions);

    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);
    console.log(`Game state initialized for room ${roomId}:`, gameState);

    await this.startAntePhase(roomId);
  }

  async startAntePhase(roomId: string): Promise<void> {
    console.log('Starting ante phase for room:', roomId);
    const gameState = await this.redisService.getGameState(roomId);
    if (!gameState || gameState.status !== 'ante') {
      console.log(`Cannot start ante phase for room ${roomId}:`, gameState);
      return;
    }

    const { updatedGameState, actions } = this.bettingService.processAnte(
      gameState,
      gameState.minBet,
    );
    gameState.log.push(...actions);

    const activePlayers = gameState.players.filter((p) => p.isActive);
    if (activePlayers.length < 2) {
      if (activePlayers.length === 1) {
        console.log(`Ending game with single winner for room ${roomId}`);
        await this.endGameWithWinner(roomId, activePlayers[0].id);
      } else {
        console.log(`Ending game with no winners for room ${roomId}`);
        await this.endGame(roomId);
      }
      return;
    }

    const dealResult =
      this.gameStateService.dealCardsToPlayers(updatedGameState);
    gameState.log.push(...dealResult.actions);

    const phaseResult = this.gameStateService.moveToNextPhase(
      dealResult.updatedGameState,
      'blind_betting',
    );
    gameState.log.push(...phaseResult.actions);

    gameState.currentPlayerIndex = this.playerService.findNextActivePlayer(
      gameState.players,
      gameState.dealerIndex,
    );

    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);
    console.log(`Ante phase completed, moved to blind_betting for room ${roomId}`);
  }

  async processAction(
    roomId: string,
    telegramId: string,
    action: string,
    amount?: number,
  ): Promise<GameActionResult> {
    console.log('Processing action:', { roomId, telegramId, action, amount });
    const gameState = await this.redisService.getGameState(roomId);
    if (!gameState) {
      console.log(`Game state not found for room ${roomId}`);
      return { success: false, error: 'Игра не найдена' };
    }

    const playerIndex = gameState.players.findIndex((p) => p.id === telegramId);
    if (playerIndex === -1) {
      console.log(`Player ${telegramId} not found in room ${roomId}`);
      return { success: false, error: 'Игрок не найден' };
    }

    if (gameState.currentPlayerIndex !== playerIndex) {
      console.log(`Not player ${telegramId}'s turn in room ${roomId}`);
      return { success: false, error: 'Сейчас не ваш ход' };
    }

    const { canPerform, error } = this.bettingService.canPerformAction(
      gameState.players[playerIndex],
      action,
      gameState,
    );

    if (!canPerform) {
      console.log(`Action not allowed for ${telegramId}:`, error);
      return { success: false, error };
    }

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
        console.log(`Invalid action ${action} for game status ${gameState.status}`);
        return {
          success: false,
          error: 'Недопустимое действие в текущей фазе',
        };
    }
  }

  // Получение данных пользователя
  private async getUserData(telegramId: string): Promise<any> {
    console.log(`Fetching user data for telegramId: ${telegramId}`);
    try {
      const user = await this.usersService.getProfile(telegramId);
      console.log(`User data fetched for ${telegramId}:`, user);
      return {
        username: user.username,
        avatar: user.avatar,
        balance: user.balance,
      };
    } catch (error) {
      console.error(`Failed to get user data for telegramId: ${telegramId}`, error);
      return null;
    }
  }

  private async processBlindBettingAction(
    roomId: string,
    gameState: GameState,
    playerIndex: number,
    action: string,
    amount?: number,
  ): Promise<GameActionResult> {
    console.log('Processing blind betting action:', { roomId, playerIndex, action, amount });
    const player = gameState.players[playerIndex];

    switch (action) {
      case 'blind_bet': {
        if (!amount || amount < gameState.lastBlindBet * 2) {
          console.log(`Invalid blind bet amount for ${player.id}:`, amount);
          return {
            success: false,
            error: `Минимальная ставка вслепую: ${
              gameState.lastBlindBet * 2 || gameState.minBet
            }`,
          };
        }

        if (player.balance < amount) {
          console.log(`Insufficient funds for ${player.id}:`, { balance: player.balance, amount });
          return { success: false, error: 'Недостаточно средств' };
        }

        const { updatedPlayer, action: blindAction } =
          this.playerService.processPlayerBet(player, amount, 'blind_bet');

        gameState.players[playerIndex] = updatedPlayer;
        gameState.pot += amount;
        gameState.lastBlindBet = amount;
        gameState.log.push(blindAction);

        gameState.currentPlayerIndex = this.playerService.findNextActivePlayer(
          gameState.players,
          gameState.currentPlayerIndex,
        );
        break;
      }
      case 'look': {
        gameState.players[playerIndex] = this.playerService.updatePlayerStatus(
          player,
          { hasLooked: true, lastAction: 'look' },
        );

        const lookAction: GameAction = {
          type: 'look',
          telegramId: player.id,
          timestamp: Date.now(),
          message: `Игрок ${player.username} посмотрел карты`,
        };
        gameState.log.push(lookAction);

        const phaseResult = this.gameStateService.moveToNextPhase(
          gameState,
          'betting',
        );
        gameState.log.push(...phaseResult.actions);

        if (gameState.lastBlindBet > 0) {
          const requiredBet = gameState.lastBlindBet * 2;
          if (player.balance < requiredBet) {
            gameState.players[playerIndex] =
              this.playerService.updatePlayerStatus(
                gameState.players[playerIndex],
                { hasFolded: true, isActive: false, lastAction: 'fold' },
              );

            const foldAction: GameAction = {
              type: 'fold',
              telegramId: player.id,
              timestamp: Date.now(),
              message: `Игрок ${player.username} сбросил карты (недостаточно средств)`,
            };
            gameState.log.push(foldAction);

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

        const activePlayers = gameState.players.filter(
          (p) => p.isActive && !p.hasFolded,
        );
        if (activePlayers.length === 1) {
          console.log(`Ending game with single winner for room ${roomId}`);
          await this.endGameWithWinner(roomId, activePlayers[0].id);
          return { success: true };
        }

        gameState.currentPlayerIndex = this.playerService.findNextActivePlayer(
          gameState.players,
          gameState.currentPlayerIndex,
        );
        break;
      }
      default:
        console.log(`Invalid blind betting action ${action} for ${player.id}`);
        return { success: false, error: 'Недопустимое действие' };
    }

    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);
    console.log(`Blind betting action processed for room ${roomId}`);
    return { success: true, gameState };
  }

  private async processBettingAction(
    roomId: string,
    gameState: GameState,
    playerIndex: number,
    action: string,
    amount?: number,
  ): Promise<GameActionResult> {
    console.log('Processing betting action:', { roomId, playerIndex, action, amount });
    const player = gameState.players[playerIndex];

    switch (action) {
      case 'call': {
        const callAmount = gameState.currentBet - player.currentBet;

        if (player.balance < callAmount) {
          console.log(`Insufficient funds for ${player.id}:`, { balance: player.balance, callAmount });
          return { success: false, error: 'Недостаточно средств' };
        }

        const { updatedPlayer: callPlayer, action: callAction } =
          this.playerService.processPlayerBet(player, callAmount, 'call');

        gameState.players[playerIndex] = callPlayer;
        gameState.pot += callAmount;
        gameState.log.push(callAction);

        gameState.currentPlayerIndex = this.playerService.findNextActivePlayer(
          gameState.players,
          gameState.currentPlayerIndex,
        );

        if (this.bettingService.isBettingRoundComplete(gameState)) {
          console.log(`Betting round complete for room ${roomId}`);
          await this.endBettingRound(roomId, gameState);
          return { success: true };
        }
        break;
      }
      case 'raise': {
        if (!amount || amount <= gameState.currentBet) {
          console.log(`Invalid raise amount for ${player.id}:`, amount);
          return {
            success: false,
            error: `Повышение должно быть больше текущей ставки ${gameState.currentBet}`,
          };
        }

        const raiseTotal = amount;
        const raiseAmount = raiseTotal - player.currentBet;

        if (player.balance < raiseAmount) {
          console.log(`Insufficient funds for ${player.id}:`, { balance: player.balance, raiseAmount });
          return { success: false, error: 'Недостаточно средств' };
        }

        const { updatedPlayer: raisePlayer, action: raiseAction } =
          this.playerService.processPlayerBet(player, raiseAmount, 'raise');

        gameState.players[playerIndex] = raisePlayer;
        gameState.pot += raiseAmount;
        gameState.currentBet = raiseTotal;
        gameState.lastRaiseIndex = playerIndex;
        gameState.log.push(raiseAction);

        gameState.currentPlayerIndex = this.playerService.findNextActivePlayer(
          gameState.players,
          gameState.currentPlayerIndex,
        );
        break;
      }
      case 'fold': {
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

        const activePlayers = gameState.players.filter(
          (p) => p.isActive && !p.hasFolded,
        );
        if (activePlayers.length === 1) {
          console.log(`Ending game with single winner for room ${roomId}`);
          await this.endGameWithWinner(roomId, activePlayers[0].id);
          return { success: true };
        }

        gameState.currentPlayerIndex = this.playerService.findNextActivePlayer(
          gameState.players,
          gameState.currentPlayerIndex,
        );

        if (this.bettingService.isBettingRoundComplete(gameState)) {
          console.log(`Betting round complete for room ${roomId}`);
          await this.endBettingRound(roomId, gameState);
          return { success: true };
        }
        break;
      }
      default:
        console.log(`Invalid betting action ${action} for ${player.id}`);
        return { success: false, error: 'Недопустимое действие' };
    }

    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);
    console.log(`Betting action processed for room ${roomId}`);
    return { success: true, gameState };
  }

  private async endBettingRound(
    roomId: string,
    gameState: GameState,
  ): Promise<void> {
    console.log('Ending betting round for room:', roomId);
    const phaseResult = this.gameStateService.moveToNextPhase(
      gameState,
      'showdown',
    );
    gameState.log.push(...phaseResult.actions);

    const scoreResult =
      this.gameStateService.calculateScoresForPlayers(gameState);
    gameState.log.push(...scoreResult.actions);

    const winners = this.playerService.determineWinners(gameState.players);
    gameState.winners = winners;

    if (winners.length > 1) {
      gameState.isSvara = true;
      const svaraAction: GameAction = {
        type: 'svara',
        telegramId: 'system',
        timestamp: Date.now(),
        message: 'Объявлена "Свара"! Несколько игроков имеют одинаковый счет.',
      };
      gameState.log.push(svaraAction);

      await this.redisService.setGameState(roomId, gameState);
      await this.redisService.publishGameUpdate(roomId, gameState);
      console.log(`Svara announced for room ${roomId}`);

      await this.startSvaraGame(
        roomId,
        winners.map((w) => w.id),
      );
    } else if (winners.length === 1) {
      console.log(`Ending game with winner for room ${roomId}`);
      await this.endGameWithWinner(roomId, winners[0].id);
    } else {
      console.log(`Ending game with no winners for room ${roomId}`);
      await this.endGame(roomId);
    }
  }

  private async startSvaraGame(
    roomId: string,
    winnerIds: string[],
  ): Promise<void> {
    console.log('Starting svara game for room:', roomId, 'Winners:', winnerIds);
    const gameState = await this.redisService.getGameState(roomId);
    if (!gameState) {
      console.log(`Game state not found for svara in room ${roomId}`);
      return;
    }

    const { updatedGameState, actions } =
      this.gameStateService.initializeSvaraGame(gameState, winnerIds);
    updatedGameState.log.push(...actions);

    const dealResult =
      this.gameStateService.dealCardsToPlayers(updatedGameState);
    updatedGameState.log.push(...dealResult.actions);

    const phaseResult = this.gameStateService.moveToNextPhase(
      dealResult.updatedGameState,
      'blind_betting',
    );
    updatedGameState.log.push(...phaseResult.actions);

    updatedGameState.currentPlayerIndex =
      this.playerService.findNextActivePlayer(
        updatedGameState.players,
        updatedGameState.dealerIndex,
      );

    await this.redisService.setGameState(roomId, updatedGameState);
    await this.redisService.publishGameUpdate(roomId, updatedGameState);
    console.log(`Svara game started for room ${roomId}`);
  }

  private async endGameWithWinner(
    roomId: string,
    winnerId: string,
  ): Promise<void> {
    console.log('Ending game with winner:', { roomId, winnerId });
    const gameState = await this.redisService.getGameState(roomId);
    if (!gameState) {
      console.log(`Game state not found for room ${roomId}`);
      return;
    }

    const { updatedGameState, actions } = this.bettingService.processWinnings(
      gameState,
      [winnerId],
    );
    updatedGameState.log.push(...actions);

    const phaseResult = this.gameStateService.moveToNextPhase(
      updatedGameState,
      'finished',
    );
    updatedGameState.log.push(...phaseResult.actions);

    await this.redisService.setGameState(roomId, updatedGameState);
    await this.redisService.publishGameUpdate(roomId, updatedGameState);
    console.log(`Game ended with winner for room ${roomId}`);

    const room = await this.redisService.getRoom(roomId);
    if (room) {
      room.status = 'finished';
      room.winner = winnerId;
      room.finishedAt = new Date();

      await this.redisService.setRoom(roomId, room);
      await this.redisService.publishRoomUpdate(roomId, room);
      console.log(`Room ${roomId} updated to finished with winner ${winnerId}`);
    }
  }

  private async endGame(roomId: string): Promise<void> {
    console.log('Ending game without winner for room:', roomId);
    const gameState = await this.redisService.getGameState(roomId);
    if (!gameState) {
      console.log(`Game state not found for room ${roomId}`);
      return;
    }

    const phaseResult = this.gameStateService.moveToNextPhase(
      gameState,
      'finished',
    );
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
    console.log(`Game ended without winner for room ${roomId}`);

    const room = await this.redisService.getRoom(roomId);
    if (room) {
      room.status = 'finished';
      room.finishedAt = new Date();

      await this.redisService.setRoom(roomId, room);
      await this.redisService.publishRoomUpdate(roomId, room);
      console.log(`Room ${roomId} updated to finished`);
    }
  }

  async markPlayerInactive(roomId: string, telegramId: string): Promise<void> {
    console.log('Marking player inactive:', { roomId, telegramId });
    const gameState = await this.redisService.getGameState(roomId);
    if (!gameState) {
      console.log(`Game state not found for room ${roomId}`);
      return;
    }

    const playerIndex = gameState.players.findIndex((p) => p.id === telegramId);
    if (playerIndex === -1) {
      console.log(`Player ${telegramId} not found in room ${roomId}`);
      return;
    }

    gameState.players[playerIndex] = this.playerService.updatePlayerStatus(
      gameState.players[playerIndex],
      { isActive: false, hasFolded: true },
    );

    const action: GameAction = {
      type: 'leave',
      telegramId,
      timestamp: Date.now(),
      message: `Игрок ${gameState.players[playerIndex].username} покинул игру`,
    };
    gameState.log.push(action);

    const activePlayers = gameState.players.filter(
      (p) => p.isActive && !p.hasFolded,
    );
    if (activePlayers.length === 1) {
      console.log(`Ending game with single winner for room ${roomId}`);
      await this.endGameWithWinner(roomId, activePlayers[0].id);
    } else if (activePlayers.length === 0) {
      console.log(`Ending game with no winners for room ${roomId}`);
      await this.endGame(roomId);
    } else {
      if (gameState.currentPlayerIndex === playerIndex) {
        gameState.currentPlayerIndex = this.playerService.findNextActivePlayer(
          gameState.players,
          gameState.currentPlayerIndex,
        );
      }

      await this.redisService.setGameState(roomId, gameState);
      await this.redisService.publishGameUpdate(roomId, gameState);
      console.log(`Player ${telegramId} marked inactive in room ${roomId}`);
    }
  }

  async getGameState(roomId: string): Promise<GameState | null> {
    console.log('Fetching game state for room:', roomId);
    const gameState = await this.redisService.getGameState(roomId);
    console.log('Game state fetched:', gameState);
    return gameState;
  }
}
