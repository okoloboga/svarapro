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
          player.balance -= minBet;
          player.tableBalance += minBet;
          player.totalBet += minBet;
          updatedGameState.pot += minBet;

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
    // Если есть только один активный игрок, круг завершен
    const activePlayers = gameState.players.filter(
      (p) => p.isActive && !p.hasFolded,
    );
    if (activePlayers.length <= 1) {
      return true;
    }

    // Определяем "якорного" игрока для завершения круга торгов.
    // Приоритет: последний повысивший -> последний ставивший вслепую -> дилер.
    const startIndex =
      gameState.lastRaiseIndex !== undefined
        ? gameState.lastRaiseIndex
        : gameState.lastBlindBettorIndex !== undefined
          ? gameState.lastBlindBettorIndex
          : gameState.dealerIndex;

    // Проверяем, что все активные игроки сделали ставки
    let allBet = true;
    for (const player of activePlayers) {
      if (player.currentBet !== gameState.currentBet) {
        allBet = false;
        break;
      }
    }

    // Если текущий игрок - это игрок после последнего повысившего (или дилера)
    // и все сделали одинаковые ставки, круг завершен
    return (
      allBet &&
      (gameState.currentPlayerIndex ===
        (startIndex + 1) % gameState.players.length ||
        gameState.currentPlayerIndex === startIndex)
    );
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
    const rake = Math.floor(updatedGameState.pot * 0.05);
    const winAmount = updatedGameState.pot - rake;

    // Если есть несколько победителей, делим выигрыш поровну
    const winPerPlayer = Math.floor(winAmount / winnerIds.length);

    for (const winnerId of winnerIds) {
      const winner = updatedGameState.players.find((p) => p.id === winnerId);
      if (winner) {
        // Добавляем выигрыш победителю
        winner.balance += winPerPlayer;

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
    updatedGameState.pot = 0;

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

      case 'call':
        if (gameState.status !== 'betting') {
          return { canPerform: false, error: 'Сейчас нельзя уравнивать' };
        }
        if (player.currentBet >= gameState.currentBet) {
          return {
            canPerform: false,
            error: 'Вы уже сделали максимальную ставку',
          };
        }
        return { canPerform: true };

      case 'raise':
        if (gameState.status !== 'betting') {
          return { canPerform: false, error: 'Сейчас нельзя повышать' };
        }
        return { canPerform: true };

      case 'fold':
        return { canPerform: true };

      default:
        return { canPerform: false, error: 'Недопустимое действие' };
    }
  }
}
