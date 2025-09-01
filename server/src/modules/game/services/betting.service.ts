import { Injectable } from '@nestjs/common';
import { GameState, Player, GameAction } from '../../../types/game';

@Injectable()
export class BettingService {
  // Обработка анте (входной ставки)
  processAnte(
    gameState: GameState,
    minBet: number,
  ): {
    updatedGameState: GameState;
    actions: GameAction[];
  } {
    const updatedGameState = { ...gameState };
    const actions: GameAction[] = [];

    for (let i = 0; i < updatedGameState.players.length; i++) {
      const player = updatedGameState.players[i];
      if (player.isActive) {
        // Проверяем, достаточно ли у игрока баланса
        if (player.balance < minBet) {
          player.isActive = false;
          player.hasFolded = true;

          // Добавляем действие в лог
          const action: GameAction = {
            type: 'fold',
            telegramId: player.id,
            timestamp: Date.now(),
            message: `Игрок ${player.username} не имеет достаточно средств для анте`,
          };
          actions.push(action);
        } else {
          // Снимаем анте с баланса игрока
          const roundedMinBet = Number(minBet.toFixed(2));
          player.balance -= roundedMinBet;
          player.totalBet = (player.totalBet || 0) + roundedMinBet; // Учитываем анте в общей ставке
          player.tableBalance += roundedMinBet;
          updatedGameState.pot = Number(
            (updatedGameState.pot + roundedMinBet).toFixed(2),
          );
          updatedGameState.chipCount += 1; // Увеличиваем счетчик фишек

          // Добавляем действие в лог
          const action: GameAction = {
            type: 'ante',
            telegramId: player.id,
            amount: minBet,
            timestamp: Date.now(),
            message: `Игрок ${player.username} внес анте ${minBet}`,
          };
          actions.push(action);
        }
      }
    }

    return { updatedGameState, actions };
  }

  // Проверка, завершился ли круг ставок
  isBettingRoundComplete(gameState: GameState): boolean {
    const activePlayers = gameState.players.filter(
      (p) => p.isActive && !p.hasFolded,
    );

    if (activePlayers.length <= 1) {
      return true;
    }

    // Определяем "якорного" игрока, на котором должен закончиться круг.
    // `raise` имеет приоритет над `blind`, как уточнил пользователь.
    let anchorPlayerIndex: number | undefined = undefined;
    if (gameState.lastRaiseIndex !== undefined) {
      anchorPlayerIndex = gameState.lastRaiseIndex;
    } else if (gameState.lastBlindBettorIndex !== undefined) {
      anchorPlayerIndex = gameState.lastBlindBettorIndex;
    } else {
      // Если не было ни raise, ни blind, якорь - дилер.
      anchorPlayerIndex = gameState.dealerIndex;
    }

    // Если якорь не определен, не можем завершить круг (не должно происходить в активной игре)
    if (anchorPlayerIndex === undefined) {
      return false;
    }

    // Круг завершен, если ход должен перейти к "якорному" игроку
    // и при этом все активные игроки уравняли ставки.
    // ИСПРАВЛЕНИЕ: Круг должен завершиться ПЕРЕД якорем, а не НА якоре
    if (gameState.currentPlayerIndex === anchorPlayerIndex) {
      const firstPlayerBet = activePlayers[0]?.totalBet;
      if (firstPlayerBet === undefined) return false; // Нет активных игроков

      const allBetsEqual = activePlayers.every(
        (p) => p.totalBet === firstPlayerBet,
      );
      return allBetsEqual;
    }

    return false;
  }

  // Обработка выигрыша
  processWinnings(
    gameState: GameState,
    winnerIds: string[],
  ): {
    updatedGameState: GameState;
    actions: GameAction[];
  } {
    const updatedGameState = { ...gameState };
    const actions: GameAction[] = [];

    // Вычисляем комиссию (5% от банка)
    const rake = Number((updatedGameState.pot * 0.05).toFixed(2));
    const winAmount = Number((updatedGameState.pot - rake).toFixed(2));

    // Если есть несколько победителей, делим выигрыш поровну
    const winPerPlayer = Number((winAmount / winnerIds.length).toFixed(2));

    // Отладочный лог для проверки выигрыша
    console.log('🎯 Win Calculation Debug:', {
      pot: updatedGameState.pot,
      rake,
      winAmount,
      winnerIds,
      winnerIdsLength: winnerIds.length,
      winPerPlayer,
    });

    for (const winnerId of winnerIds) {
      const winner = updatedGameState.players.find((p) => p.id === winnerId);
      if (winner) {
        // Добавляем выигрыш победителю
        const roundedWinPerPlayer = Number(winPerPlayer.toFixed(2));
        winner.balance += roundedWinPerPlayer;

        // Добавляем действие в лог
        const action: GameAction = {
          type: 'win',
          telegramId: winnerId,
          amount: winPerPlayer,
          timestamp: Date.now(),
          message: `Игрок ${winner.username} выиграл ${winPerPlayer}`,
        };
        actions.push(action);
      }
    }

    // Устанавливаем комиссию и обнуляем банк
    updatedGameState.rake = rake;
    updatedGameState.pot = 0.0;

    // Устанавливаем победителей для анимации
    updatedGameState.winners = winnerIds
      .map((id) => updatedGameState.players.find((p) => p.id === id))
      .filter(Boolean) as Player[];

    // Добавляем действие о комиссии в лог
    if (rake > 0) {
      const action: GameAction = {
        type: 'join',
        telegramId: 'system',
        timestamp: Date.now(),
        message: `Комиссия: ${rake}`,
      };
      actions.push(action);
    }

    return { updatedGameState, actions };
  }

  // Проверка возможности действия
  canPerformAction(
    player: Player,
    action: string,
    gameState: GameState,
  ): {
    canPerform: boolean;
    error?: string;
  } {
    if (!player.isActive || player.hasFolded) {
      return { canPerform: false, error: 'Игрок не активен' };
    }

    switch (action) {
      case 'blind_bet':
        if (player.hasLooked) {
          return { canPerform: false, error: 'Вы уже посмотрели карты' };
        }
        return { canPerform: true };

      case 'look':
        if (player.hasLooked) {
          return { canPerform: false, error: 'Вы уже посмотрели карты' };
        }
        return { canPerform: true };

      case 'call': {
        // Разрешаем call в фазе betting или в blind_betting после look
        if (gameState.status === 'betting') {
          // Разрешаем колл, если игрок является последним, кто повышал ставку.
          // Это действие завершит раунд торгов.
          const isLastRaiser =
            gameState.lastRaiseIndex !== undefined &&
            gameState.players[gameState.lastRaiseIndex]?.id === player.id;

          if (isLastRaiser) {
            return { canPerform: true }; // Allow last raiser to "call" to end the round
          }

          // Under the new rules, you can always call the last bet.
          // The check for whether a bet exists is handled by game.service.
          return { canPerform: true };
        }
        
        // Разрешаем call в blind_betting только если игрок посмотрел карты
        if (gameState.status === 'blind_betting' && player.hasLookedAndMustAct) {
          return { canPerform: true };
        }
        
        return { canPerform: false, error: 'Сейчас нельзя уравнивать' };
      }

      case 'raise': {
        if (gameState.status === 'betting') {
          return { canPerform: true };
        }
        // ИСПРАВЛЕНИЕ: В blind_betting raise разрешен только для игроков, которые посмотрели карты
        if (gameState.status === 'blind_betting' && player.hasLookedAndMustAct) {
          return { canPerform: true };
        }
        return { canPerform: false, error: 'Сейчас нельзя повышать' };
      }

      case 'fold':
        return { canPerform: true };

      case 'all_in':
        return { canPerform: true };

      default:
        return { canPerform: false, error: 'Недопустимое действие' };
    }
  }
}
