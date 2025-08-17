// Существующий тип Room
export interface Room {
  roomId: string;
  minBet: number;
  type: 'public' | 'private';
  players: string[];
  status: 'waiting' | 'playing' | 'finished';
  maxPlayers: number;
  createdAt: Date;
  finishedAt?: Date;
  password?: string;
  winner?: string; // telegramId победителя
}

// Новые типы для игры
export interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: 'A' | 'K' | 'Q' | 'J' | '10' | '9' | '8' | '7';
  isJoker?: boolean; // флаг для 7 треф (джокер)
  value: number; // числовое значение карты
}

export interface Player {
  id: string; // telegramId
  username: string;
  avatar: string | null;
  balance: number; // общий баланс игрока
  tableBalance: number; // баланс на столе
  cards: Card[]; // карты в руке
  isActive: boolean; // активен ли игрок в текущей игре
  isDealer: boolean; // является ли дилером
  hasFolded: boolean; // сбросил ли карты
  hasLooked: boolean; // посмотрел ли карты (для ставок вслепую)
  currentBet: number; // текущая ставка в раунде
  totalBet: number; // общая ставка в игре
  score?: number; // очки игрока (вычисляются при вскрытии)
  position: number; // позиция за столом (0-5)
  lastAction?: 'fold' | 'check' | 'call' | 'raise' | 'blind' | 'look'; // последнее действие
}

export interface GameState {
  roomId: string;
  status:
    | 'waiting'
    | 'ante'
    | 'blind_betting'
    | 'betting'
    | 'showdown'
    | 'svara'
    | 'finished';
  players: Player[];
  deck: Card[]; // колода
  pot: number; // банк
  currentPlayerIndex: number; // индекс текущего игрока
  dealerIndex: number; // индекс дилера
  lastRaiseIndex?: number; // индекс последнего повысившего ставку
  lastBlindBettorIndex?: number; // индекс последнего, кто ставил вслепую
  minBet: number; // минимальная ставка
  currentBet: number; // текущая ставка в раунде
  lastBlindBet: number; // последняя ставка вслепую
  lastActionAmount: number; // сумма последнего действия (call или raise)
  rake: number; // комиссия (налог)
  winners: Player[]; // победители
  isSvara: boolean; // объявлена ли "свара"
  round: number; // номер раунда
  timer?: number; // таймер для хода
  log: GameAction[]; // лог действий
  isAnimating?: boolean; // флаг анимации (блокирует действия)
  animationType?: 'chip_fly' | 'win_animation'; // тип текущей анимации
  showWinnerAnimation?: boolean; // флаг для показа анимации победы
}

export interface GameAction {
  type:
    | 'join'
    | 'leave'
    | 'ante'
    | 'blind_bet'
    | 'look'
    | 'bet'
    | 'call'
    | 'raise'
    | 'fold'
    | 'win'
    | 'svara';
  telegramId: string;
  amount?: number;
  timestamp: number;
  message?: string; // текстовое описание действия
}

export interface GameActionResult {
  success: boolean;
  error?: string;
  gameState?: GameState | null;
}
