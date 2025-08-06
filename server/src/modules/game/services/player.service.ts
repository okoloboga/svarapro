import { Injectable } from '@nestjs/common';
import { Player, GameAction } from '../../../types/game';

@Injectable()
export class PlayerService {
  // Создание нового игрока
  createPlayer(id: string, userData: any, position: number): Player {
    return {
      id,
      username: userData.username || 'Player',
      avatar: userData.avatar || '',
      balance: userData.balance || 0,
      tableBalance: 0,
      cards: [],
      isActive: true,
      isDealer: false,
      hasFolded: false,
      hasLooked: false,
      currentBet: 0,
      totalBet: 0,
      position,
    };
  }

  // Обновление статуса игрока
  updatePlayerStatus(player: Player, status: {
    isActive?: boolean;
    hasFolded?: boolean;
    hasLooked?: boolean;
    isDealer?: boolean;
    lastAction?: 'fold' | 'check' | 'call' | 'raise' | 'blind';
  }): Player {
    return {
      ...player,
      ...status,
    };
  }

  // Сброс состояния игрока для новой игры
  resetPlayerForNewGame(player: Player, isActive: boolean = true): Player {
    return {
      ...player,
      cards: [],
      isActive,
      hasFolded: !isActive,
      hasLooked: false,
      currentBet: 0,
      totalBet: 0,
      score: undefined,
      lastAction: undefined,
    };
  }

  // Добавление карт игроку
  addCardsToPlayer(player: Player, cards: any[]): Player {
    return {
      ...player,
      cards,
    };
  }

  // Обработка ставки игрока
  processPlayerBet(player: Player, amount: number, action: string): { 
    updatedPlayer: Player; 
    action: GameAction;
  } {
    const updatedPlayer = { ...player };
    updatedPlayer.balance -= amount;
    updatedPlayer.tableBalance += amount;
    updatedPlayer.currentBet += amount;
    updatedPlayer.totalBet += amount;
    updatedPlayer.lastAction = action as any;

    const gameAction: GameAction = {
      type: action as any,
      playerId: player.id,
      amount,
      timestamp: Date.now(),
      message: `Игрок ${player.username} ${this.getActionDescription(action)} ${amount}`,
    };

    return { updatedPlayer, action: gameAction };
  }

  // Получение описания действия
  private getActionDescription(action: string): string {
    switch (action) {
      case 'ante': return 'внес анте';
      case 'blind_bet': return 'сделал ставку вслепую';
      case 'call': return 'уравнял';
      case 'raise': return 'повысил до';
      case 'fold': return 'сбросил карты';
      default: return action;
    }
  }

  // Определение победителей
  determineWinners(players: Player[]): Player[] {
    const activePlayers = players.filter(p => p.isActive && !p.hasFolded);
    if (activePlayers.length === 0) {
      return [];
    }
    
    // Находим максимальный счет
    const maxScore = Math.max(...activePlayers.map(p => p.score || 0));
    
    // Возвращаем всех игроков с максимальным счетом
    return activePlayers.filter(p => (p.score || 0) === maxScore);
  }

  // Нахождение следующего активного игрока
  findNextActivePlayer(players: Player[], currentIndex: number): number {
    let nextPlayerIndex = (currentIndex + 1) % players.length;
    
    // Пропускаем неактивных игроков и тех, кто сбросил карты
    const startIndex = nextPlayerIndex;
    
    do {
      if (players[nextPlayerIndex].isActive && !players[nextPlayerIndex].hasFolded) {
        return nextPlayerIndex;
      }
      nextPlayerIndex = (nextPlayerIndex + 1) % players.length;
    } while (nextPlayerIndex !== startIndex);
    
    // Если не нашли активного игрока, возвращаем текущий индекс
    return currentIndex;
  }
}
