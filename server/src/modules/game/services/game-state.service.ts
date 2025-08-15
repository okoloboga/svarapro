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
      pot: 0,
      currentPlayerIndex: 0,
      dealerIndex: 0,
      minBet,
      currentBet: 0,
      lastBlindBet: 0,
      rake: 0,
      winners: [],
      isSvara: false,
      round: 0,
      log: [],
    };
  }

  // Инициализация новой игры
  initializeNewGame(gameState: GameState): {
    updatedGameState: GameState;
    actions: GameAction[];
  } {
    const updatedGameState = { ...gameState };
    const actions: GameAction[] = [];

    // Сбрасываем состояние игры
    updatedGameState.status = 'ante';
    updatedGameState.round += 1;
    updatedGameState.currentBet = 0;
    updatedGameState.lastBlindBet = 0;
    updatedGameState.winners = [];
    updatedGameState.isSvara = false;

    // Выбираем дилера случайным образом или переходим к следующему
    if (updatedGameState.round === 1) {
      updatedGameState.dealerIndex =
        Math.floor(Math.random() * updatedGameState.players.length) || 0;
    } else {
      updatedGameState.dealerIndex = this.playerService.findNextActivePlayer(
        updatedGameState.players,
        updatedGameState.dealerIndex,
      );
    }

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
    winnerIds: string[],
  ): {
    updatedGameState: GameState;
    actions: GameAction[];
  } {
    const updatedGameState = { ...gameState };
    const actions: GameAction[] = [];

    // Сохраняем банк для новой игры
    const svaraPot = updatedGameState.pot;

    // Сбрасываем состояние игры
    updatedGameState.status = 'ante';
    updatedGameState.round += 1;
    updatedGameState.pot = svaraPot; // Сохраняем банк
    updatedGameState.currentBet = 0;
    updatedGameState.lastBlindBet = 0;
    updatedGameState.winners = [];
    updatedGameState.isSvara = false;

    // Обновляем дилера (первый из победителей)
    updatedGameState.dealerIndex =
      updatedGameState.players.findIndex((p) => p.id === winnerIds[0]) || 0;

    // Сбрасываем состояние игроков
    for (let i = 0; i < updatedGameState.players.length; i++) {
      updatedGameState.players[i] = this.playerService.resetPlayerForNewGame(
        updatedGameState.players[i],
        winnerIds.includes(updatedGameState.players[i].id),
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
      message: 'Начинается новая игра для "Свары"',
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

  // Раздача карт игрокам
  dealCardsToPlayers(gameState: GameState): {
    updatedGameState: GameState;
    actions: GameAction[];
  } {
    const updatedGameState = { ...gameState };
    const actions: GameAction[] = [];

    // Раздаем по 3 карты каждому активному игроку
    for (let i = 0; i < updatedGameState.players.length; i++) {
      if (updatedGameState.players[i].isActive) {
        const { cards, remainingDeck } = this.cardService.dealCards(
          updatedGameState.deck,
          3,
        );
        updatedGameState.players[i] = this.playerService.addCardsToPlayer(
          updatedGameState.players[i],
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
