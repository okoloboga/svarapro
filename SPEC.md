# SPEC.md - Техническое описание геймплея Svara

## Обзор игры

**Svara** - это карточная игра на ставки для 2-6 игроков, основанная на принципах покера с уникальной механикой "свары" (повторной игры при ничьей). Игра использует специальную колоду из 32 карт (без 2-6) с джокером (7 треф).

## Структура игры

### Фазы игры

1. **`waiting`** - Ожидание игроков
2. **`ante`** - Фаза входных ставок
3. **`blind_betting`** - Фаза ставок вслепую
4. **`betting`** - Фаза обычных ставок
5. **`showdown`** - Вскрытие карт
6. **`svara_pending`** - Ожидание решения по сваре
7. **`svara`** - Фаза свары
8. **`finished`** - Игра завершена

### Переходы между фазами

```
waiting → ante → blind_betting → betting → showdown → svara_pending → svara → finished
                    ↓              ↓           ↓
                 finished      finished   finished
```

## Детальная механика

### 1. Фаза `ante` (Входные ставки)

**Цель:** Каждый игрок делает обязательную ставку для участия в игре.

**Механика:**
- Все игроки делают ставку равную `minBet`
- Ставка добавляется в общий банк (`pot`)
- После всех ставок игра переходит в `blind_betting`

**Технические детали:**
- Проверка баланса игрока: `player.balance >= minBet`
- Обновление: `player.balance -= minBet`, `gameState.pot += minBet`
- Установка дилера: случайный выбор или следующий после предыдущего победителя

### 2. Фаза `blind_betting` (Ставки вслепую)

**Цель:** Игроки могут делать ставки не глядя на карты или посмотреть карты.

**Доступные действия:**
- **`look`** - посмотреть карты (переводит в обычную фазу ставок)
- **`blind`** - ставка вслепую (удваивает предыдущую ставку)

**Механика ставок вслепую:**
- Первая ставка: `minBet`
- Каждая следующая ставка: `previousBlindBet * 2`
- Игрок может смотреть карты в любой момент
- После `look` игрок переходит в обычную фазу ставок

**Технические детали:**
- Якорь: последний игрок, делавший blind ставку (`lastBlindBettorIndex`)
- Переход в `betting`: когда игрок делает `look` + `call/raise`
- Проверка баланса: `player.balance >= nextBlindBet`

### 3. Фаза `betting` (Обычные ставки)

**Цель:** Игроки делают ставки, зная свои карты.

**Доступные действия:**
- **`fold`** - сбросить карты (выход из игры)
- **`call`** - уравнять ставку
- **`raise`** - повысить ставку
- **`check`** - пропустить ход (если нечего уравнивать)

**Механика ставок:**
- Минимальный raise: `currentBet + minBet`
- Максимальный raise: весь баланс игрока
- Якорь: последний игрок, делавший raise (`lastRaiseIndex`)

**Завершение круга ставок:**
- Ход возвращается к якорю
- Все активные игроки уравняли ставки
- Менее 2 активных игроков

**Технические детали:**
- Расчет суммы для call: `getAmountToCall(gameState, playerId)`
- Расчет минимального raise: `getMinRaise(gameState)`
- Расчет максимального raise: `getMaxRaise(gameState, playerId)`
- Проверка завершения: `isBettingRoundComplete(gameState)`

### 4. Фаза `showdown` (Вскрытие карт)

**Цель:** Определить победителя на основе очков карт.

**Механика подсчета очков:**
- Каждая карта имеет числовое значение
- Джокер (7 треф) = 0 очков
- Сумма очков всех карт в руке
- Игрок с наибольшим количеством очков выигрывает

**Возможные исходы:**
- **Один победитель** → переход в `finished`
- **Несколько победителей с одинаковыми очками** → переход в `svara_pending`

### 5. Фаза `svara_pending` (Ожидание свары)

**Цель:** Игроки решают, участвовать ли в сваре.

**Механика свары:**
- Участники свары: игроки с одинаковыми очками
- Время на решение: `TURN_DURATION_SECONDS` (30 секунд)
- Другие игроки могут присоединиться, заплатив взнос

**Взнос за вход в свару:**
- Размер взноса = изначальный банк свары (`svaraOriginalPot`)
- Все игроки платят одинаковую сумму
- Взнос добавляется к банку свары

**Технические детали:**
- Таймер свары: `svaraTimers.set(roomId, timer)`
- Автоматическое разрешение: `resolveSvara(roomId)`
- Проверка всех решений: `_checkSvaraCompletion(roomId, gameState)`

### 6. Фаза `svara` (Свара)

**Цель:** Повторная игра с теми же участниками и увеличенным банком.

**Механика свары:**
- Новый раунд игры с участниками свары
- Банк переносится из предыдущей игры
- Обычные правила игры (ante → blind_betting → betting → showdown)
- При повторной ничьей - новая свара

**Обработка игроков с нулевым балансом:**
- **2 игрока в сваре, у одного 0$** → сразу showdown
- **2+ игроков в сваре, у некоторых 0$** → автоматический fold игроков без денег

## Технические компоненты

### Управление состоянием

**GameState:**
```typescript
interface GameState {
  status: GamePhase;
  players: Player[];
  pot: number;
  currentPlayerIndex: number;
  dealerIndex: number;
  lastRaiseIndex?: number;
  lastBlindBettorIndex?: number;
  svaraOriginalPot?: number;
  // ... другие поля
}
```

**Player:**
```typescript
interface Player {
  id: string;
  balance: number;
  cards: Card[];
  isActive: boolean;
  hasFolded: boolean;
  hasLooked: boolean;
  totalBet: number;
  // ... другие поля
}
```

### Логика якорей

**Определение якоря:**
- **В `blind_betting`**: `lastBlindBettorIndex` (последний blind bettor)
- **В `betting`**: `lastRaiseIndex` (последний raise)
- **Fallback**: `dealerIndex` (дилер)

**Установка якоря:**
- `look → call` устанавливает якорь (только если якорь не установлен)
- `raise` всегда устанавливает новый якорь
- `call` после установленного якоря не изменяет якорь

### Таймеры

**Таймер хода:**
- Длительность: `TURN_DURATION_SECONDS` (30 секунд)
- Автоматический fold при истечении времени
- Очистка при смене фазы игры

**Таймер свары:**
- Длительность: `TURN_DURATION_SECONDS` (30 секунд)
- Автоматическое разрешение свары
- Очистка при завершении свары

### Обработка ошибок

**Игроки с нулевым балансом:**
- Блокировка действий (кроме fold и raise)
- Автоматический fold по таймеру
- Завершение игры при отсутствии игроков с деньгами

**Защита от бесконечных циклов:**
- Флаг `endGameInProgress` для `endGameWithWinner`
- Проверка фазы в `processAction`
- Валидация переходов между фазами

## Алгоритмы

### Поиск следующего игрока

```typescript
findNextActivePlayer(players: Player[], currentIndex: number): number {
  const activePlayers = players.filter(p => p.isActive && !p.hasFolded);
  
  if (activePlayers.length <= 1) return -1;
  
  // Поиск следующего активного игрока по кругу
  for (let i = 1; i <= players.length; i++) {
    const nextIndex = (currentIndex + i) % players.length;
    const player = players[nextIndex];
    
    if (player.isActive && !player.hasFolded) {
      return nextIndex;
    }
  }
  
  return -1;
}
```

### Проверка завершения круга ставок

```typescript
isBettingRoundComplete(gameState: GameState): boolean {
  const activePlayers = gameState.players.filter(p => p.isActive && !p.hasFolded);
  const playersWhoCanAct = activePlayers.filter(p => p.balance > 0);

  if (playersWhoCanAct.length < 2) return true;

  const anchorIndex = getAnchorPlayerIndex(gameState);
  
  if (gameState.currentPlayerIndex === anchorIndex) {
    const playersWithMoney = activePlayers.filter(p => p.balance > 0);
    if (playersWithMoney.length === 0) return true;
    
    const firstBet = playersWithMoney[0].totalBet;
    return playersWithMoney.every(p => p.totalBet === firstBet);
  }

  return false;
}
```

### Определение победителей

```typescript
determineWinners(players: Player[]): Player[] {
  const activePlayers = players.filter(p => p.isActive && !p.hasFolded);
  if (activePlayers.length === 0) return [];
  
  const maxScore = Math.max(...activePlayers.map(p => p.score || 0));
  const winners = activePlayers.filter(p => (p.score || 0) === maxScore);
  
  return winners;
}
```

## Особенности реализации

### Колода карт

- **32 карты**: A, K, Q, J, 10, 9, 8, 7 (все масти)
- **Джокер**: 7 треф = 0 очков
- **Значения**: A=11, K=10, Q=10, J=10, 10=10, 9=9, 8=8, 7=7, 7♣=0

### Анимации

- **`chip_fly`** - полет фишек при ставках
- **`win_animation`** - анимация победы
- Блокировка действий во время анимаций

### Логирование

- Все действия записываются в `gameState.log`
- Типы действий: `join`, `leave`, `ante`, `blind_bet`, `look`, `bet`, `call`, `raise`, `fold`, `win`, `svara`
- Временные метки для всех действий

### Безопасность

- Валидация всех действий игроков
- Проверка баланса перед ставками
- Защита от повторных вызовов критических функций
- Валидация переходов между фазами

## Заключение

Игра Svara представляет собой сложную систему с множественными состояниями, требующую точной координации между различными компонентами. Ключевые аспекты включают правильное управление якорями, обработку свары, таймеры и защиту от ошибок. Все механизмы спроектированы для обеспечения честной и увлекательной игры.
