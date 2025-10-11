import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../services/redis.service';
import {
  GameState,
  GameActionResult,
  GameAction,
} from '../../../types/game';
import { PlayerService } from './player.service';
import { BettingService } from './betting.service';
import { GameStateService } from './game-state.service';
import { GameTimerService } from './game-timer.service';
import { GameSpecialActionsService } from './game-special-actions.service';
import { GameEndService } from './game-end.service';
import { CardService } from './card.service';

@Injectable()
export class GameActionService {
  private readonly logger = new Logger(GameActionService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly playerService: PlayerService,
    private readonly bettingService: BettingService,
    private readonly gameStateService: GameStateService,
    private readonly gameTimerService: GameTimerService,
    private readonly gameSpecialActionsService: GameSpecialActionsService,
    private readonly gameEndService: GameEndService,
    private readonly cardService: CardService,
  ) {}

  async processAction(
    roomId: string,
    telegramId: string,
    action: string,
    amount?: number,
  ): Promise<GameActionResult> {
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

    // Упрощенная проверка хода
    if (gameState.currentPlayerIndex !== playerIndex) {
      return { success: false, error: 'Сейчас не ваш ход' };
    }

    // Очищаем таймер при любом действии (кроме look)
    if (action !== 'look') {
      this.gameTimerService.clearTurnTimer(roomId);
    }

    // Сбрасываем счетчик бездействия
    if (player.inactivityCount && player.inactivityCount > 0) {
      gameState.players[playerIndex] = this.playerService.updatePlayerStatus(
        player,
        { inactivityCount: 0 },
      );
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
          return this.gameSpecialActionsService.processBlindBettingCallAction(
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
          return this.gameSpecialActionsService.processBlindBettingRaiseAction(
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
        return this.gameSpecialActionsService.handleAllIn(roomId, gameState, playerIndex, amount);
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
      await this.gameEndService.endGameWithWinner(roomId, gameState);
      return { success: true };
    }

    // Check players who can still make a move
    const playersWhoCanAct = playersInGame.filter(
      (p) => !p.isAllIn && p.balance > 0,
    );

    if (playersWhoCanAct.length < 2) {
      // If 0 or 1 players can still act, the betting part of the round is over.
      // This covers cases where remaining players are all-in.
      await this.gameEndService.endBettingRound(roomId, gameState);
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
        await this.gameEndService.endBettingRound(roomId, gameState);
        return { success: true };
      } else {
        gameState.currentPlayerIndex = aboutToActPlayerIndex;
        // Устанавливаем время начала хода и запускаем таймер
        gameState.turnStartTime = Date.now();
        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        if (currentPlayer) {
          this.gameTimerService.startTurnTimer(roomId, currentPlayer.id);
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
          this.gameTimerService.startTurnTimer(roomId, currentPlayer.id);
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
          await this.gameEndService.endBettingRound(roomId, gameState);
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

        // После look->raise в blind_betting, игра переходит в betting
        // В betting якорем становится игрок, который сделал raise
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
          await this.gameEndService.endBettingRound(roomId, gameState);
          return { success: true, gameState };
        } else {
          console.log(`[BLIND_BETTING_DEBUG] Changing turn from ${gameState.currentPlayerIndex} to ${aboutToActPlayerIndex}`);
          gameState.currentPlayerIndex = aboutToActPlayerIndex;
          // Устанавливаем время начала хода и запускаем таймер
          gameState.turnStartTime = Date.now();
          const currentPlayer = gameState.players[gameState.currentPlayerIndex];
          if (currentPlayer) {
            console.log(`[BLIND_BETTING_DEBUG] Starting timer for new player: ${currentPlayer.id}`);
            this.gameTimerService.startTurnTimer(roomId, currentPlayer.id);
          }
        }
        break;
      }
    }

    // gameState.isAnimating = true;
    // gameState.animationType = 'chip_fly';

    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);

    // Упрощенная проверка завершения круга
    if (this.bettingService.isBettingRoundComplete(gameState)) {
      await this.gameEndService.endBettingRound(roomId, gameState);
      return { success: true, gameState };
    }

    // Передаем ход следующему игроку
    const nextPlayerIndex = this.playerService.findNextActivePlayer(
      gameState.players,
      gameState.currentPlayerIndex,
    );
    
    gameState.currentPlayerIndex = nextPlayerIndex;
    gameState.turnStartTime = Date.now();
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer) {
      this.gameTimerService.startTurnTimer(roomId, currentPlayer.id);
    }
    
    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);
    return { success: true, gameState };
  }
}
