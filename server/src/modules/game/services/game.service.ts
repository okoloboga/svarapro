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
import { PotManager } from '../lib/pot-manager';
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
    const gameState = await this.redisService.getGameState(roomId);

    if (room) {
      room.players = room.players.filter((pId) => pId !== telegramId);
      if (room.players.length === 0) {
        console.log(`Room ${roomId} is now empty, removing it.`);
        await this.redisService.removeRoom(roomId);
        await this.redisService.clearGameData(roomId);
        await this.redisService.publishRoomUpdate(roomId, null);
      } else {
        await this.redisService.setRoom(roomId, room);
        await this.redisService.publishRoomUpdate(roomId, room);
      }
    }

    if (gameState) {
      const playerIndex = gameState.players.findIndex((p) => p.id === telegramId);

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
          (p) => p.isActive && !p.hasFolded,
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
    console.log(`[startGame] Starting game for room ${roomId}`);
    const room = await this.redisService.getRoom(roomId);
    if (!room || (room.status !== 'waiting' && room.status !== 'finished')) {
      console.log(`[startGame] Cannot start game for room ${roomId}:`, {
        hasRoom: !!room,
        roomStatus: room?.status,
        allowedStatuses: ['waiting', 'finished']
      });
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

    console.log(`[startGame] Game successfully started for room ${roomId}, starting ante phase`);
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
    
    console.log(`[startAntePhase] Ante phase completed for room ${roomId}, moved to blind_betting`);
  }

  private svaraTimers: Map<string, NodeJS.Timeout> = new Map();

  async joinSvara(
    roomId: string,
    telegramId: string,
  ): Promise<GameActionResult> {
    const gameState = await this.redisService.getGameState(roomId);
    if (!gameState) {
      return { success: false, error: 'Игра не найдена' };
    }

    if (gameState.status !== 'svara_pending') {
      if (gameState.svaraConfirmed?.includes(telegramId)) {
        return { success: true, gameState };
      } else {
        return { success: false, error: 'Сейчас нельзя присоединиться к сваре' };
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

    if (!player) {
      return { success: false, error: 'Игрок не найден в этой игре' };
    }

    if (action === 'fold') {
      if (gameState.currentPlayerIndex !== playerIndex) {
        return { success: false, error: 'Сейчас не ваш ход' };
      }
      return this.handleFold(roomId, gameState, playerIndex);
    }

    if (player.hasLookedAndMustAct && !['raise', 'call', 'all_in'].includes(action)) {
      return {
        success: false,
        error:
          'После просмотра карт вы можете только повысить, ответить или сбросить карты',
      };
    }

    if (gameState.currentPlayerIndex !== playerIndex) {
      return { success: false, error: 'Сейчас не ваш ход' };
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
      case 'raise':
        return this.processBettingAction(
          roomId,
          gameState,
          playerIndex,
          action,
          amount,
        );
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

    if (
      gameState.status === 'blind_betting' &&
      gameState.lastBlindBettorIndex !== undefined
    ) {
      const lastBettor = gameState.players[gameState.lastBlindBettorIndex];
      if (lastBettor && lastBettor.id !== player.id) {
        gameState.players[playerIndex] = this.playerService.updatePlayerStatus(
          player,
          {
            hasFolded: true,
            lastAction: 'fold',
            hasLookedAndMustAct: false,
          },
        );
        const foldAction: GameAction = {
          type: 'fold',
          telegramId: player.id,
          timestamp: Date.now(),
          message: `Игрок ${player.username} сбросил карты в ответ на ставку вслепую`,
        };
        gameState.log.push(foldAction);

        await this.redisService.setGameState(roomId, gameState);
        await this.redisService.publishGameUpdate(roomId, gameState);

        await this.endGameWithWinner(roomId, gameState);
        return { success: true };
      }
    }

    gameState.players[playerIndex] = this.playerService.updatePlayerStatus(
      player,
      {
        hasFolded: true,
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

    const activePlayers = gameState.players.filter((p) => !p.hasFolded);

    if (activePlayers.length === 1) {
      await this.redisService.setGameState(roomId, gameState);
      await this.redisService.publishGameUpdate(roomId, gameState);
      await this.endGameWithWinner(roomId, gameState);
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
        gameState.players[playerIndex] = this.playerService.updatePlayerStatus(
          updatedPlayer,
          { lastAction: 'blind' },
        );
        gameState.pot = Number((gameState.pot + blindBetAmount).toFixed(2));
        gameState.chipCount += 1;
        gameState.lastBlindBet = blindBetAmount;
        gameState.lastBlindBettorIndex = playerIndex;
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
        if (player.hasLookedAndMustAct) {
          const callAmount =
            gameState.lastBlindBet > 0
              ? gameState.lastBlindBet * 2
              : gameState.minBet;

          if (player.balance < callAmount) {
            return { success: false, error: 'Недостаточно средств' };
          }

          const { updatedPlayer, action: callAction } =
            this.playerService.processPlayerBet(player, callAmount, 'call');

          gameState.players[playerIndex] = this.playerService.updatePlayerStatus(
            updatedPlayer,
            { hasLookedAndMustAct: false },
          );
          gameState.pot = Number((gameState.pot + callAmount).toFixed(2));
          gameState.chipCount += 1;
          gameState.lastActionAmount = callAmount;
          gameState.lastRaiseIndex = playerIndex;
          gameState.log.push(callAction);

          const phaseResult = this.gameStateService.moveToNextPhase(
            gameState,
            'betting',
          );
          gameState = phaseResult.updatedGameState;
          gameState.log.push(...phaseResult.actions);

          for (let i = 0; i < gameState.players.length; i++) {
            if (i !== playerIndex && gameState.players[i].isActive && !gameState.players[i].hasFolded) {
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
          break;
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
        gameState.pot = Number((gameState.pot + callAmount).toFixed(2));
        gameState.chipCount += 1;
        gameState.lastActionAmount = callAmount;
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

        gameState.players[playerIndex] = this.playerService.updatePlayerStatus(
          updatedPlayer,
          { hasLookedAndMustAct: false },
        );
        gameState.pot = Number((gameState.pot + raiseAmount).toFixed(2));
        gameState.chipCount += 1;
        gameState.lastRaiseIndex = playerIndex;
        gameState.lastActionAmount = raiseAmount;
        gameState.log.push(raiseAction);

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
        break;
      }
    }

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
    const scoreResult = this.gameStateService.calculateScoresForPlayers(gameState);
    gameState = scoreResult.updatedGameState;
    gameState.log.push(...scoreResult.actions);

    await this.endGameWithWinner(roomId, gameState);
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
      console.log(
        `All ${totalPlayers} players have made a decision for svara in room ${roomId}. Resolving immediately.`,
      );
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

    await new Promise((resolve) => setTimeout(resolve, 3000));

    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);
  }

  private async endGameWithWinner(
    roomId: string,
    gameState: GameState,
  ): Promise<void> {
    if (!gameState) return;

    console.log(`[endGameWithWinner] Starting winner determination for room ${roomId}`);

    const scoreResult =
      this.gameStateService.calculateScoresForPlayers(gameState);
    gameState = scoreResult.updatedGameState;
    gameState.log.push(...scoreResult.actions);

    const activePlayers = gameState.players.filter((p) => !p.hasFolded);
    const overallWinners = this.playerService.determineWinners(activePlayers);

    if (overallWinners.length > 1) {
      console.log(`Svara detected in room ${roomId}. Pot will be carried over.`);
      const phaseResult = this.gameStateService.moveToNextPhase(
        gameState,
        'svara_pending',
      );
      gameState = phaseResult.updatedGameState;
      gameState.log.push(...phaseResult.actions);

      gameState.isSvara = true;
      gameState.svaraParticipants = overallWinners.map((w) => w.id);
      gameState.winners = overallWinners;
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
    } else {
      console.log(`Winner determined in room ${roomId}. Publishing 'showdown' state.`);
      const phaseResult = this.gameStateService.moveToNextPhase(
        gameState,
        'showdown',
      );
      gameState = phaseResult.updatedGameState;
      gameState.log.push(...phaseResult.actions);
      gameState.winners = overallWinners;

      await this.redisService.setGameState(roomId, gameState);
      await this.redisService.publishGameUpdate(roomId, gameState);

      setTimeout(() => {
        this.distributeWinnings(roomId).catch((error) => {
          console.error(`Failed to distribute winnings for room ${roomId}:`, error);
        });
      }, 3000);
    }
  }

  private async distributeWinnings(roomId: string): Promise<void> {
    let gameState = await this.redisService.getGameState(roomId);
    if (!gameState) {
      console.error(`[distributeWinnings] Game state not found for room ${roomId}`);
      return;
    }

    console.log(`[distributeWinnings] Distributing winnings for room ${roomId}`);

    // Reset lastWinAmount for all players
    for (const p of gameState.players) {
      p.lastWinAmount = 0;
    }

    const isAllInGame = gameState.players.some((p) => p.isAllIn);
    const winners = gameState.winners || [];

    if (winners.length === 0) {
      console.log('[distributeWinnings] No winners found, ending game.');
      await this.endGame(roomId, gameState, 'no_winner');
      return;
    }

    if (isAllInGame) {
      console.log(`[distributeWinnings] All-in game detected in room ${roomId}.`);
      const potManager = new PotManager();
      potManager.processBets(gameState.players);
      const potWinnersList = potManager.getWinners(gameState.players);

      for (const potResult of potWinnersList) {
        const { winners: potWinnerPlayers, amount } = potResult;
        if (potWinnerPlayers.length > 0) {
          const winAmount = Number((amount / potWinnerPlayers.length).toFixed(2));
          for (const winner of potWinnerPlayers) {
            const playerInState = gameState.players.find((p) => p.id === winner.id);
            if (playerInState) {
              playerInState.balance += winAmount;
              playerInState.lastWinAmount = (playerInState.lastWinAmount || 0) + winAmount;
            }
          }
        }
      }
      gameState.pot = 0;
      gameState.chipCount = 0;
    } else if (winners.length === 1) {
      console.log(`[distributeWinnings] Standard win in room ${roomId}.`);
      const winnerId = winners[0].id;
      const winnerBefore = gameState.players.find(p => p.id === winnerId);
      const balanceBefore = winnerBefore ? winnerBefore.balance : 0;

      const { updatedGameState, actions } = this.bettingService.processWinnings(
        gameState,
        [winnerId],
      );
      gameState = updatedGameState;
      gameState.log.push(...actions);

      const winnerAfter = gameState.players.find(p => p.id === winnerId);
      const balanceAfter = winnerAfter ? winnerAfter.balance : 0;
      if (winnerAfter) {
        winnerAfter.lastWinAmount = balanceAfter - balanceBefore;
      }
    }

    for (const player of gameState.players) {
      await this.usersService.updatePlayerBalance(player.id, player.balance);
      await this.redisService.publishBalanceUpdate(player.id, player.balance);
    }

    const phaseResult = this.gameStateService.moveToNextPhase(
      gameState,
      'finished',
    );
    gameState = phaseResult.updatedGameState;
    gameState.log.push(...phaseResult.actions);

    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);

    await this.endGame(roomId, gameState, 'winner');
  }

  private async endGame(roomId: string, gameState: GameState, reason: 'winner' | 'no_winner' | 'svara'): Promise<void> {
    console.log(`[endGame] Ending game for room ${roomId}, reason: ${reason}`);

    const room = await this.redisService.getRoom(roomId);
    if (room) {
      room.status = 'finished';
      room.finishedAt = new Date();
      room.winner = reason === 'winner' && gameState.winners ? gameState.winners[0]?.id : undefined;
      await this.redisService.setRoom(roomId, room);
      await this.redisService.publishRoomUpdate(roomId, room);
    }

    console.log(`[endGame] Scheduling auto-restart for room ${roomId} in 5 seconds`);
    setTimeout(() => {
      console.log(`[endGame] Auto-restarting game for room ${roomId}`);
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

    const { updatedPlayer, action: allInAction } = this.playerService.processPlayerBet(
      player,
      allInAmount,
      'all_in',
    );

    gameState.players[playerIndex] = this.playerService.updatePlayerStatus(updatedPlayer, {
      isAllIn: true,
      lastAction: 'raise',
    });

    gameState.pot = Number((gameState.pot + allInAmount).toFixed(2));
    gameState.chipCount += 1;
    gameState.lastActionAmount = allInAmount;
    gameState.lastRaiseIndex = playerIndex;
    gameState.log.push(allInAction);

    const activePlayers = gameState.players.filter((p) => p.isActive && !p.hasFolded);
    const allInPlayers = activePlayers.filter((p) => p.isAllIn);

    if (allInPlayers.length === activePlayers.length) {
      await this.endBettingRound(roomId, gameState);
    } else {
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
    }

    return { success: true, gameState };
  }
}