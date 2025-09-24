import { Injectable } from '@nestjs/common';
import { GameState, GameAction } from '../../../types/game';
import { CardService } from './card.service';
import { PlayerService } from './player.service';

@Injectable()
export class GameStateService {
  constructor(
    private readonly cardService: CardService,
    private readonly playerService: PlayerService,
  ) {}

  // Создание начального состояния игры
  createInitialGameState(roomId: string, minBet: number): GameState {
    return {
      roomId,
      status: 'waiting',
      players: [],
      deck: [],
      pot: 0.0,
      currentPlayerIndex: 0,
      dealerIndex: 0,
      minBet,
      currentBet: 0,
      lastBlindBet: 0,
      lastActionAmount: 0, // Инициализируем сумму последнего действия
      rake: 0,
      winners: [],
      isSvara: false,
      round: 0,
      log: [],
      chipCount: 0,
    };
  }

  // Инициализация новой игры
  initializeNewGame(
    gameState: GameState,
    previousWinnerId?: string,
  ): {
    updatedGameState: GameState;
    actions: GameAction[];
  } {
    const updatedGameState = { ...gameState };
    const actions: GameAction[] = [];

    // Сортируем игроков по их позиции за столом для корректного порядка ходов
    updatedGameState.players.sort((a, b) => a.position - b.position);

    // Сбрасываем состояние игры
    updatedGameState.status = 'ante';
    updatedGameState.round += 1;
    updatedGameState.currentBet = 0;
    updatedGameState.lastBlindBet = 0;
    updatedGameState.lastBlindBettorIndex = undefined;
    updatedGameState.lastRaiseIndex = undefined; // ИСПРАВЛЕНИЕ: сбрасываем якорь рейза
    updatedGameState.lastActionAmount = 0; // Инициализируем сумму последнего действия
    updatedGameState.winners = [];
    updatedGameState.isSvara = false;
    updatedGameState.chipCount = 0;

    // Выбираем дилера на основе правил
    let newDealerIndex = -1;

    // При Сваре дилер не меняется
    if (updatedGameState.isSvara) {
      newDealerIndex = updatedGameState.dealerIndex;
    } else if (previousWinnerId) {
      newDealerIndex = updatedGameState.players.findIndex(
        (p) => p.id === previousWinnerId,
      );
    }

    // Если победитель не найден (или ушел), или это первый раунд, или нет победителя - выбираем случайно
    if (newDealerIndex === -1) {
      newDealerIndex =
        Math.floor(Math.random() * updatedGameState.players.length) || 0;
    }

    updatedGameState.dealerIndex = newDealerIndex;

    // Сбрасываем состояние игроков
    for (let i = 0; i < updatedGameState.players.length; i++) {
      updatedGameState.players[i] = this.playerService.resetPlayerForNewGame(
        updatedGameState.players[i],
        true,
      );
      updatedGameState.players[i].isDealer = i === updatedGameState.dealerIndex;
    }

    // Создаем и перемешиваем колоду
    updatedGameState.deck = this.cardService.shuffleDeck(
      this.cardService.createDeck(),
    );

    // Добавляем действие в лог
    const action: GameAction = {
      type: 'join',
      telegramId: 'system',
      timestamp: Date.now(),
      message: `Раунд ${updatedGameState.round} начался`,
    };
    actions.push(action);

    return { updatedGameState, actions };
  }

  // Инициализация игры для "свары"
  initializeSvaraGame(
    gameState: GameState,
    participantIds: string[],
  ): {
    updatedGameState: GameState;
    actions: GameAction[];
  } {
    const updatedGameState = { ...gameState };
    const actions: GameAction[] = [];

    // Банк уже обновлен теми, кто присоединился к сваре

    // Сбрасываем состояние игры
    updatedGameState.status = 'ante';
    updatedGameState.round += 1;
    updatedGameState.currentBet = 0;
    updatedGameState.lastBlindBet = 0;
    updatedGameState.lastBlindBettorIndex = undefined; // ИСПРАВЛЕНИЕ: сброс якоря blind
    updatedGameState.lastRaiseIndex = undefined; // ИСПРАВЛЕНИЕ: сброс якоря raise
    updatedGameState.lastActionAmount = 0;
    updatedGameState.winners = [];
    updatedGameState.isSvara = true; // Флаг, что это раунд свары
    updatedGameState.svaraParticipants = []; // Очищаем после использования
    
    // Дилер не меняется при сваре

    // Сбрасываем состояние игроков
    for (let i = 0; i < updatedGameState.players.length; i++) {
      const player = updatedGameState.players[i];
      const isParticipant = participantIds.includes(player.id);

      updatedGameState.players[i] = this.playerService.resetPlayerForNewGame(
        player,
        isParticipant, // Активен только если участник свары
      );
      updatedGameState.players[i].isDealer = i === updatedGameState.dealerIndex;
    }

    // Создаем и перемешиваем новую колоду
    updatedGameState.deck = this.cardService.shuffleDeck(
      this.cardService.createDeck(),
    );

    // Добавляем действие в лог
    const action: GameAction = {
      type: 'svara',
      telegramId: 'system',
      timestamp: Date.now(),
      message: 'Начинается раунд свары!',
    };
    actions.push(action);

    return { updatedGameState, actions };
  }

  // Переход к следующей фазе игры
  moveToNextPhase(
    gameState: GameState,
    nextPhase: GameState['status'],
  ): {
    updatedGameState: GameState;
    actions: GameAction[];
  } {
    const updatedGameState = { ...gameState };
    const actions: GameAction[] = [];

    updatedGameState.status = nextPhase;

    // Добавляем действие в лог
    const phaseMessages: Record<GameState['status'], string> = {
      waiting: 'Ожидание игроков',
      ante: 'Начинается фаза входных ставок',
      blind_betting: 'Начинается фаза ставок вслепую',
      betting: 'Начинается фаза обычных ставок',
      showdown: 'Начинается вскрытие карт',
      svara: 'Объявлена свара',
      svara_pending: 'Ожидание игроков для свары',
      finished: 'Игра завершена',
    };

    const message = phaseMessages[nextPhase] || `Переход к фазе: ${nextPhase}`;
    const action: GameAction = {
      type: 'join',
      telegramId: 'system',
      timestamp: Date.now(),
      message,
    };
    actions.push(action);

    return { updatedGameState, actions };
  }

  dealCardsToPlayers(gameState: GameState): {
    updatedGameState: GameState;
    actions: GameAction[];
  } {
    const updatedGameState = { ...gameState };
    const actions: GameAction[] = [];

    // Раздаем по 3 карты каждому активному игроку
    for (let i = 0; i < updatedGameState.players.length; i++) {
      const player = updatedGameState.players[i];

      if (player.isActive) {
        const { cards, remainingDeck } = this.cardService.dealCards(
          updatedGameState.deck,
          3,
        );

        updatedGameState.players[i] = this.playerService.addCardsToPlayer(
          player,
          cards,
        );
        updatedGameState.deck = remainingDeck;
      }
    }

    // Добавляем действие в лог
    const action: GameAction = {
      type: 'join',
      telegramId: 'system',
      timestamp: Date.now(),
      message: 'Карты розданы',
    };
    actions.push(action);

    return { updatedGameState, actions };
  }

  // Вычисление очков для всех игроков
  calculateScoresForPlayers(gameState: GameState): {
    updatedGameState: GameState;
    actions: GameAction[];
  } {
    const updatedGameState = { ...gameState };
    const actions: GameAction[] = [];

    // Вычисляем очки для каждого активного игрока
    for (let i = 0; i < updatedGameState.players.length; i++) {
      if (
        updatedGameState.players[i].isActive &&
        !updatedGameState.players[i].hasFolded
      ) {
        const score = this.cardService.calculateScore(
          updatedGameState.players[i].cards,
        );
        updatedGameState.players[i] = {
          ...updatedGameState.players[i],
          score,
        };

        // Добавляем действие в лог
        const action: GameAction = {
          type: 'join',
          telegramId: updatedGameState.players[i].id,
          timestamp: Date.now(),
          message: `Игрок ${updatedGameState.players[i].username} имеет ${score} очков`,
        };
        actions.push(action);
      }
    }

    return { updatedGameState, actions };
  }
}
