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
    await this.redisService.setRoom(roomId, room);
    await this.redisService.publishRoomUpdate(roomId, room);

    const gameState = await this.redisService.getGameState(roomId);
    if (gameState) {
      const playerIndex = gameState.players.findIndex(
        (p) => p.id === telegramId,
      );
      if (playerIndex > -1) {
        const removedPlayer = gameState.players.splice(playerIndex, 1)[0];

        try {
          await this.usersService.updatePlayerBalance(
            telegramId,
            removedPlayer.balance,
          );
          console.log(
            `Player ${telegramId} left room - balance saved to DB: ${removedPlayer.balance}`,
          );

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

    const gameState = await this.redisService.getGameState(roomId);

    if (room.status === 'finished' && gameState) {
      const minBalance = room.minBet * 10;
      gameState.players = gameState.players.filter(
        (p) => p.balance >= minBalance,
      );
    }

    if (!gameState || gameState.players.length < 2) {
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

  private svaraTimers: Map<string, NodeJS.Timeout> = new Map();

  async joinSvara(
    roomId: string,
    telegramId: string,
  ): Promise<GameActionResult> {
    const gameState = await this.redisService.getGameState(roomId);
    if (!gameState || gameState.status !== 'svara_pending') {
      return { success: false, error: 'Сейчас нельзя присоединиться к сваре' };
    }

    const player = gameState.players.find((p) => p.id === telegramId);
    if (!player) {
      return { success: false, error: 'Игрок не найден' };
    }

    if (
      gameState.svaraParticipants &&
      gameState.svaraParticipants.includes(telegramId)
    ) {
      return { success: false, error: 'Вы уже участвуете в сваре' };
    }

    const svaraBuyInAmount = gameState.pot;
    if (player.balance < svaraBuyInAmount) {
      return {
        success: false,
        error: 'Недостаточно средств для входа в свару',
      };
    }

    player.balance -= svaraBuyInAmount;
    gameState.pot += svaraBuyInAmount;

    if (!gameState.svaraParticipants) {
      gameState.svaraParticipants = [];
    }
    gameState.svaraParticipants.push(telegramId);

    const action: GameAction = {
      type: 'join',
      telegramId,
      timestamp: Date.now(),
      message: `Игрок ${player.username} присоединился к сваре, добавив в банк ${svaraBuyInAmount}`,
    };
    gameState.log.push(action);

    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);

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

    const player = gameState.players.find((p) => p.id === telegramId);
    if (!player) {
      return { success: false, error: 'Игрок не найден' };
    }

    const action: GameAction = {
      type: 'fold',
      telegramId,
      timestamp: Date.now(),
      message: `Игрок ${player.username} решил пропустить свару`,
    };
    gameState.log.push(action);

    await this.redisService.publishGameUpdate(roomId, gameState);

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

    const events = [{ name: 'play_sound', payload: 'fold', to: roomId }];

    try {
      await this.usersService.updatePlayerBalance(player.id, player.balance);
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
      const result = await this.endGameWithWinner(roomId, activePlayers[0].id);
      return { ...result, events: [...(result.events || []), ...events] };
    }

    gameState.currentPlayerIndex = this.playerService.findNextActivePlayer(
      gameState.players,
      gameState.currentPlayerIndex,
    );
    if (this.bettingService.isBettingRoundComplete(gameState)) {
      await this.endBettingRound(roomId, gameState);
      return { success: true, events };
    }

    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);
    return { success: true, gameState, events };
  }

  private async processBlindBettingAction(
    roomId: string,
    gameState: GameState,
    playerIndex: number,
    action: string,
  ): Promise<GameActionResult> {
    // ... (existing implementation)
    return { success: true, gameState };
  }

  private async processBettingAction(
    roomId: string,
    gameState: GameState,
    playerIndex: number,
    action: string,
    amount?: number,
  ): Promise<GameActionResult> {
    // ... (existing implementation)
    return { success: true, gameState };
  }

  private async endBettingRound(
    roomId: string,
    gameState: GameState,
  ): Promise<void> {
    // ... (existing implementation)
  }

  private async resolveSvara(roomId: string): Promise<void> {
    // ... (existing implementation)
  }

  private async startSvaraGame(
    roomId: string,
    participantIds: string[],
  ): Promise<void> {
    // ... (existing implementation)
  }

  private async endGameWithWinner(
    roomId: string,
    winnerId: string,
  ): Promise<GameActionResult> {
    let gameState = await this.redisService.getGameState(roomId);
    if (!gameState) return { success: false, error: 'Игра не найдена' };

    const originalPot = gameState.pot;

    const { updatedGameState, actions } = this.bettingService.processWinnings(
      gameState,
      [winnerId],
    );
    gameState = updatedGameState;
    gameState.log.push(...actions);

    gameState.pot = originalPot;

    const phaseResult = this.gameStateService.moveToNextPhase(
      gameState,
      'finished',
    );
    gameState = phaseResult.updatedGameState;
    gameState.log.push(...phaseResult.actions);

    gameState.showWinnerAnimation = true;

    const events = [{ name: 'play_sound', payload: 'win', to: winnerId }];

    try {
      const playersToUpdate = gameState.players.map((player) => ({
        telegramId: player.id,
        balance: player.balance,
      }));
      await this.usersService.updateMultiplePlayerBalances(playersToUpdate);

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

    setTimeout(() => {
      this.startGame(roomId).catch((err) =>
        console.error(`Failed to auto-restart game ${roomId}`, err),
      );
    }, 5000);

    return { success: true, gameState, events };
  }

  private async endGame(roomId: string): Promise<void> {
    // ... (existing implementation)
  }
}
