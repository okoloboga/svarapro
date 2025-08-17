import { Injectable } from '@nestjs/common';
import { Player, GameAction, Card } from '../../../types/game';
import { UserDataDto } from '../dto/user-data.dto';

@Injectable()
export class PlayerService {
  // Создание нового игрока
  createPlayer(
    telegramId: string,
    userData: UserDataDto,
    position: number,
    balance: number,
  ): Player {
    return {
      id: telegramId,
      username: userData.username || 'Player',
      avatar: userData.photo_url || null,
      balance: balance || 0,
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
  updatePlayerStatus(
    player: Player,
    status: {
      isActive?: boolean;
      hasFolded?: boolean;
      hasLooked?: boolean;
      isDealer?: boolean;
      lastAction?: 'fold' | 'check' | 'call' | 'raise' | 'blind' | 'look';
    },
  ): Player {
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
  addCardsToPlayer(player: Player, cards: Card[]): Player {
    return {
      ...player,
      cards,
    };
  }

  // Обработка ставки игрока
  processPlayerBet(
    player: Player,
    amount: number,
    action: string,
  ): {
    updatedPlayer: Player;
    action: GameAction;
  } {
    // Округляем сумму до 2 знаков после запятой
    const roundedAmount = Number(amount.toFixed(2));
    
    const updatedPlayer = { ...player };
    updatedPlayer.balance -= roundedAmount;
    updatedPlayer.tableBalance += roundedAmount;
    updatedPlayer.currentBet += roundedAmount;
    updatedPlayer.totalBet += roundedAmount;
    updatedPlayer.lastAction = action as
      | 'fold'
      | 'check'
      | 'call'
      | 'raise'
      | 'blind'
      | 'look';

    const gameAction: GameAction = {
      type: action as GameAction['type'],
      telegramId: player.id,
      amount: roundedAmount,
      timestamp: Date.now(),
      message: `Игрок ${player.username} ${this.getActionDescription(
        action,
      )} ${roundedAmount}`,
    };

    return { updatedPlayer, action: gameAction };
  }

  // Получение описания действия
  private getActionDescription(action: string): string {
    switch (action) {
      case 'ante':
        return 'внес анте';
      case 'blind_bet':
        return 'сделал ставку вслепую';
      case 'call':
        return 'уравнял';
      case 'raise':
        return 'повысил до';
      case 'fold':
        return 'сбросил карты';
      default:
        return action;
    }
  }

  // Определение победителей
  determineWinners(players: Player[]): Player[] {
    const activePlayers = players.filter((p) => p.isActive && !p.hasFolded);
    
    // Отладочный лог для проверки определения победителей
    console.log('🎯 Determine Winners Debug:', {
      totalPlayers: players.length,
      activePlayersCount: activePlayers.length,
      activePlayers: activePlayers.map(p => ({ 
        id: p.id, 
        username: p.username, 
        score: p.score, 
        isActive: p.isActive, 
        hasFolded: p.hasFolded 
      })),
      allPlayers: players.map(p => ({ 
        id: p.id, 
        username: p.username, 
        score: p.score, 
        isActive: p.isActive, 
        hasFolded: p.hasFolded 
      }))
    });
    
    if (activePlayers.length === 0) {
      console.log('❌ No active players found');
      return [];
    }

    // Находим максимальный счет
    const maxScore = Math.max(...activePlayers.map((p) => p.score || 0));
    console.log('📊 Max score:', maxScore);

    // Возвращаем всех игроков с максимальным счетом
    const winners = activePlayers.filter((p) => (p.score || 0) === maxScore);
    console.log('🏆 Winners found:', winners.map(w => ({ id: w.id, username: w.username, score: w.score })));
    
    return winners;
  }

  // Нахождение следующего активного игрока
  findNextActivePlayer(players: Player[], currentIndex: number): number {
    let nextPlayerIndex = (currentIndex + 1) % players.length;

    // Пропускаем неактивных игроков и тех, кто сбросил карты
    const startIndex = nextPlayerIndex;

    do {
      if (
        players[nextPlayerIndex].isActive &&
        !players[nextPlayerIndex].hasFolded
      ) {
        return nextPlayerIndex;
      }
      nextPlayerIndex = (nextPlayerIndex + 1) % players.length;
    } while (nextPlayerIndex !== startIndex);

    // Если не нашли активного игрока, возвращаем текущий индекс
    return currentIndex;
  }
}
