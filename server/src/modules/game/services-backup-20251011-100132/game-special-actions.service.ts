import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../services/redis.service';
import {
  GameState,
  GameActionResult,
} from '../../../types/game';
import { PlayerService } from './player.service';
import { GameStateService } from './game-state.service';
import { BettingService } from './betting.service';

@Injectable()
export class GameSpecialActionsService {
  private readonly logger = new Logger(GameSpecialActionsService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly playerService: PlayerService,
    private readonly gameStateService: GameStateService,
    private readonly bettingService: BettingService,
  ) {}

  async handleAllIn(
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
    const currentBetToCall = gameState.lastActionAmount || 0;
    const canCoverBet = player.balance >= currentBetToCall;
    
    // Forced call: игрок не может покрыть ставку, но идет all-in
    const isForcedCall = currentBetToCall > 0 && !canCoverBet;
    
    // Voluntary raise: игрок может покрыть ставку, но выбирает all-in (больше текущей ставки)
    const isVoluntaryRaise = canCoverBet && allInAmount > currentBetToCall;
    
    // Simple call: игрок может покрыть ставку и делает ровно столько, сколько нужно
    const isSimpleCall = canCoverBet && allInAmount === currentBetToCall && currentBetToCall > 0;

    const { updatedPlayer, action: allInAction } =
      this.playerService.processPlayerBet(player, allInAmount, 'all_in');

    // Устанавливаем правильный lastAction в зависимости от типа all-in
    let lastAction: 'call' | 'raise' = 'call';
    if (isVoluntaryRaise) {
      lastAction = 'raise';
    } else if (isForcedCall || isSimpleCall) {
      lastAction = 'call';
    }

    gameState.players[playerIndex] = this.playerService.updatePlayerStatus(
      updatedPlayer,
      {
        isAllIn: true,
        lastAction: lastAction,
      },
    );

    // Обновляем lastActionAmount только если это raise
    if (isVoluntaryRaise) {
      gameState.lastActionAmount = allInAmount;
      gameState.lastRaiseIndex = playerIndex;
    } else {
      // Для call не обновляем lastActionAmount и lastRaiseIndex
      gameState.lastActionAmount = Math.max(gameState.lastActionAmount, allInAmount);
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

    // Логика завершения раунда для all-in
    if (isVoluntaryRaise && playersWhoCanStillBet.length > 0) {
      // All-in был рейзом, и есть кому на него отвечать - игра продолжается
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
      // All-in был коллом, или на рейз некому отвечать - раунд завершается
      this.logger.log(
        `[${roomId}] All-in не требует ответа или отвечать некому. Завершение раунда.`,
      );
      // Возвращаем флаг для завершения раунда
      return { success: true, gameState, shouldEndBettingRound: true };
    }

    return { success: true, gameState };
  }

  async processBlindBettingCallAction(
    roomId: string,
    gameState: GameState,
    playerIndex: number,
  ): Promise<GameActionResult> {
    console.log(`[BLIND_CALL_DEBUG] Starting processBlindBettingCallAction for room ${roomId}, playerIndex ${playerIndex}`);
    console.log(`[BLIND_CALL_DEBUG] Stack trace:`, new Error().stack?.split('\n').slice(1, 4).join('\n'));
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

    // Call НЕ должен создавать новый якорь - якорем остается предыдущий blind bettor
    // gameState.lastRaiseIndex НЕ изменяется для call

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

    // В blind_betting после look->call якорем остается предыдущий blind bettor
    // Потому что call не создает новый якорь, а только уравнивает
    const anchorPlayerIndex = this.bettingService.getAnchorPlayerIndex(gameState);

    console.log(`[BLIND_BETTING_CALL_DEBUG] Player ${playerIndex} made call after look`);
    console.log(`[BLIND_BETTING_CALL_DEBUG] Current player index: ${gameState.currentPlayerIndex}`);
    console.log(`[BLIND_BETTING_CALL_DEBUG] About to act player index: ${aboutToActPlayerIndex}`);
    console.log(`[BLIND_BETTING_CALL_DEBUG] Anchor player index: ${anchorPlayerIndex}`);
    console.log(`[BLIND_BETTING_CALL_DEBUG] Last raise index: ${gameState.lastRaiseIndex}`);
    console.log(`[BLIND_BETTING_CALL_DEBUG] Last blind bettor index: ${gameState.lastBlindBettorIndex}`);
    console.log(`[BLIND_BETTING_CALL_DEBUG] Dealer index: ${gameState.dealerIndex}`);

    // Всегда обновляем currentPlayerIndex перед проверкой
    gameState.currentPlayerIndex = aboutToActPlayerIndex;
    
    // Если следующий игрок - якорь, то круг завершается
    if (aboutToActPlayerIndex === anchorPlayerIndex) {
      console.log(`[BLIND_BETTING_CALL_DEBUG] Ending betting round, aboutToActPlayerIndex: ${aboutToActPlayerIndex}, anchorPlayerIndex: ${anchorPlayerIndex}`);
      // Возвращаем флаг для завершения раунда
      return { success: true, gameState, shouldEndBettingRound: true };
    } else {
      console.log(`[BLIND_BETTING_CALL_DEBUG] Changing turn to ${aboutToActPlayerIndex}`);
      // Возвращаем флаг для запуска таймера
      return { success: true, gameState, shouldStartTimer: true };
    }
  }

  async processBlindBettingRaiseAction(
    roomId: string,
    gameState: GameState,
    playerIndex: number,
    amount?: number,
  ): Promise<GameActionResult> {
    console.log(`[BLIND_RAISE_DEBUG] Starting processBlindBettingRaiseAction for room ${roomId}, playerIndex ${playerIndex}, amount ${amount}`);
    console.log(`[BLIND_RAISE_DEBUG] Stack trace:`, new Error().stack?.split('\n').slice(1, 4).join('\n'));
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

    // В blind_betting после look->raise якорем становится сам игрок, который сделал raise
    // Потому что raise создает новый якорь
    const anchorPlayerIndex = this.bettingService.getAnchorPlayerIndex(gameState);

    console.log(`[BLIND_BETTING_RAISE_DEBUG] Player ${playerIndex} made raise after look`);
    console.log(`[BLIND_BETTING_RAISE_DEBUG] Current player index: ${gameState.currentPlayerIndex}`);
    console.log(`[BLIND_BETTING_RAISE_DEBUG] About to act player index: ${aboutToActPlayerIndex}`);
    console.log(`[BLIND_BETTING_RAISE_DEBUG] Anchor player index: ${anchorPlayerIndex}`);
    console.log(`[BLIND_BETTING_RAISE_DEBUG] Last raise index: ${gameState.lastRaiseIndex}`);
    console.log(`[BLIND_BETTING_RAISE_DEBUG] Last blind bettor index: ${gameState.lastBlindBettorIndex}`);
    console.log(`[BLIND_BETTING_RAISE_DEBUG] Dealer index: ${gameState.dealerIndex}`);

    // Всегда обновляем currentPlayerIndex перед проверкой
    gameState.currentPlayerIndex = aboutToActPlayerIndex;
    
    // Если следующий игрок - якорь, то круг завершается
    if (aboutToActPlayerIndex === anchorPlayerIndex) {
      console.log(`[BLIND_BETTING_RAISE_DEBUG] Ending betting round, aboutToActPlayerIndex: ${aboutToActPlayerIndex}, anchorPlayerIndex: ${anchorPlayerIndex}`);
      // Возвращаем флаг для завершения раунда
      return { success: true, gameState, shouldEndBettingRound: true };
    } else {
      console.log(`[BLIND_BETTING_RAISE_DEBUG] Changing turn to ${aboutToActPlayerIndex}`);
      // Возвращаем флаг для запуска таймера
      return { success: true, gameState, shouldStartTimer: true };
    }
  }
}
