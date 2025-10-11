# 🎮 GAME MODULE GUIDE

## 📁 АРХИТЕКТУРА МОДУЛЯ

### **Основные сервисы:**

#### **GameService** (`services/game.service.ts`) - Координатор
- **Роль**: Тонкий координатор, делегирует вызовы специализированным сервисам
- **Размер**: 138 строк (было 1917)
- **Ответственность**: Обработка флагов результата, координация между сервисами
- **Ключевые методы**: `processAction()`, `handleAutoFold()`, `joinSvara()`, `skipSvara()`

#### **GameRoomService** (`services/game-room.service.ts`) - Управление комнатами
- **Роль**: Управление комнатами и игроками
- **Размер**: ~200 строк
- **Ответственность**: Создание/удаление комнат, присоединение/выход игроков
- **Ключевые методы**: `getRooms()`, `joinRoom()`, `leaveRoom()`, `sitDown()`

#### **GameLifecycleService** (`services/game-lifecycle.service.ts`) - Жизненный цикл игры
- **Роль**: Инициализация и управление игрой
- **Размер**: ~300 строк
- **Ответственность**: Старт игры, фазы ante, раздача карт
- **Ключевые методы**: `startGame()`, `startAntePhase()`, `initializeNewGame()`

#### **GameActionService** (`services/game-action.service.ts`) - Обработка действий
- **Роль**: Обработка действий игроков
- **Размер**: ~400 строк
- **Ответственность**: fold, call, raise, look, blind_bet
- **Ключевые методы**: `processAction()`, `handleFold()`, `processBlindBettingAction()`, `processBettingAction()`

#### **GameTimerService** (`services/game-timer.service.ts`) - Управление таймерами
- **Роль**: Управление таймерами ходов
- **Размер**: ~150 строк
- **Ответственность**: Автоматический fold, очистка таймеров
- **Ключевые методы**: `startTurnTimer()`, `clearTurnTimer()`, `handleAutoFold()`

#### **SvaraService** (`services/svara.service.ts`) - Логика свары
- **Роль**: Логика свары (ничьи)
- **Размер**: ~300 строк
- **Ответственность**: Объявление свары, участие/отказ, новая игра
- **Ключевые методы**: `joinSvara()`, `skipSvara()`, `declareSvara()`, `resolveSvara()`

#### **GameEndService** (`services/game-end.service.ts`) - Завершение игры
- **Роль**: Завершение игры и распределение выигрышей
- **Размер**: ~400 строк
- **Ответственность**: Определение победителей, распределение банков, комиссия
- **Ключевые методы**: `endBettingRound()`, `determineWinnersAfterShowdown()`, `distributeWinnings()`

#### **GameSpecialActionsService** (`services/game-special-actions.service.ts`) - Специальные действия
- **Роль**: All-in и специальные действия в blind_betting
- **Размер**: ~200 строк
- **Ответственность**: All-in, call/raise после look в blind_betting
- **Ключевые методы**: `handleAllIn()`, `processBlindBettingCallAction()`, `processBlindBettingRaiseAction()`

### **Вспомогательные сервисы:**

#### **PlayerService** (`services/player.service.ts`) - Управление игроками
- **Роль**: Создание, обновление игроков, расчет очков
- **Ключевые методы**: `createPlayer()`, `updatePlayerStatus()`, `processPlayerBet()`, `determineWinners()`

#### **BettingService** (`services/betting.service.ts`) - Логика ставок
- **Роль**: Обработка анте, проверка завершения раунда
- **Ключевые методы**: `processAnte()`, `isBettingRoundComplete()`, `canPerformAction()`

#### **GameStateService** (`services/game-state.service.ts`) - Управление состоянием
- **Роль**: Создание состояний, переходы между фазами, раздача карт
- **Ключевые методы**: `createInitialGameState()`, `moveToNextPhase()`, `dealCardsToPlayers()`

#### **CardService** (`services/card.service.ts`) - Работа с картами
- **Роль**: Расчет очков, работа с колодой
- **Ключевые методы**: `calculateScore()`, `createDeck()`, `shuffleDeck()`

## 🎯 ИГРОВЫЕ ФАЗЫ И ЛОГИКА

### **1. ANTE (Взносы)**
- **Файл**: `GameLifecycleService.startAntePhase()`
- **Логика**: Каждый игрок вносит минимальную ставку
- **Переход**: После ante → раздача карт → blind_betting

### **2. BLIND_BETTING (Ставки вслепую)**
- **Файл**: `GameActionService.processBlindBettingAction()`
- **Действия**: `blind_bet`, `look`
- **Логика**: 
  - `blind_bet`: Удваивает предыдущую ставку вслепую
  - `look`: Открывает карты, устанавливает `hasLookedAndMustAct = true`
- **Переход**: После `look` → доступны `call`, `raise`, `fold`

### **3. BETTING (Обычные ставки)**
- **Файл**: `GameActionService.processBettingAction()`
- **Действия**: `call`, `raise`, `fold`, `all_in`
- **Логика**: Стандартные покерные действия
- **Переход**: После завершения круга → showdown

### **4. SHOWDOWN (Вскрытие)**
- **Файл**: `GameEndService.determineWinnersAfterShowdown()`
- **Логика**: Определение победителей, проверка на свару
- **Переход**: Победитель → распределение выигрышей, Ничья → свара

### **5. SVARA (Ничья)**
- **Файл**: `SvaraService`
- **Логика**: Новая игра с теми же участниками, банк переносится
- **Действия**: `join_svara`, `skip_svara`

## 🔧 КЛЮЧЕВЫЕ АЛГОРИТМЫ

### **Определение якоря (Anchor)**
```typescript
// Приоритет якорей:
1. lastRaiseIndex (последний, кто делал raise)
2. lastBlindBettorIndex (последний, кто делал blind bet)
3. dealerIndex (дилер)
```

### **Логика свары**
```typescript
// Условия свары:
1. Несколько победителей с одинаковыми очками
2. Участники подтверждают участие (join_svara)
3. Новая игра с переносом банка
```

### **Распределение банков**
```typescript
// PotManager обрабатывает:
1. Основной банк (все игроки)
2. Боковые банки (all-in игроки)
3. Возврат неизрасходованных ставок
4. Комиссия (5%)
```

## ⚠️ ПОТЕНЦИАЛЬНЫЕ ПРОБЛЕМЫ

### **1. Зацикливание хода**
- **Где**: `GameActionService.processBettingAction()`
- **Проблема**: Неправильное определение якоря после `look->raise`
- **Решение**: Правильная логика якоря в `processBlindBettingRaiseAction()`

### **2. Дублирование обработки**
- **Где**: `GameService.processAction()`
- **Проблема**: Флаги результата не обрабатывались
- **Решение**: Обработка флагов `shouldEndBettingRound`, `shouldStartTimer`

### **3. Неправильный якорь в blind_betting**
- **Где**: `GameSpecialActionsService.processBlindBettingCallAction()`
- **Проблема**: Call не должен создавать новый якорь
- **Решение**: Якорем остается предыдущий blind bettor

### **4. Проблемы с таймерами**
- **Где**: `GameTimerService`
- **Проблема**: Таймеры не очищаются при смене хода
- **Решение**: `clearTurnTimer()` перед `startTurnTimer()`

## 🎮 СООТВЕТСТВИЕ ИГРОВОЙ ЛОГИКЕ

### **Правила игры СВАРА:**
1. **Раздача**: 3 карты каждому игроку
2. **Анте**: Минимальная ставка для участия
3. **Blind Betting**: Ставки вслепую с удвоением
4. **Look**: Открытие карт, обязательные действия
5. **Betting**: Обычные ставки после открытия
6. **Showdown**: Вскрытие карт, определение победителей
7. **Svara**: Ничья → новая игра с переносом банка

### **Специальные правила:**
- **All-in**: Игрок ставит все фишки
- **Комиссия**: 5% от банка
- **Таймеры**: Автоматический fold через 30 секунд
- **Исключение**: 3 раза подряд бездействие

## 🔍 ОТЛАДКА И ЛОГИ

### **Ключевые логи:**
```typescript
// Определение якоря
console.log(`[BLIND_BETTING_DEBUG] Ending betting round, aboutToActPlayerIndex: ${aboutToActPlayerIndex}, anchorPlayerIndex: ${anchorPlayerIndex}`);

// Смена хода
console.log(`[BLIND_BETTING_DEBUG] Changing turn from ${gameState.currentPlayerIndex} to ${aboutToActPlayerIndex}`);

// Автоматический fold
console.log(`[AUTO_FOLD_DEBUG] Auto fold for player: ${telegramId}, playerIndex: ${playerIndex}, currentPlayerIndex: ${gameState.currentPlayerIndex}`);
```

### **Проверка состояния:**
```typescript
// Активные игроки
const activePlayers = gameState.players.filter(p => p.isActive && !p.hasFolded);

// Игроки, которые могут действовать
const playersWhoCanAct = activePlayers.filter(p => !p.isAllIn && p.balance > 0);

// Завершение раунда
const isComplete = this.bettingService.isBettingRoundComplete(gameState);
```

## 📊 МЕТРИКИ КАЧЕСТВА

### **До рефакторинга:**
- GameService: 1917 строк (критично)
- GameLogicService: 643 строки (дублирование)
- Общий объем: 2560 строк

### **После рефакторинга:**
- GameService: 138 строк (координатор)
- 7 специализированных сервисов: ~200-400 строк каждый
- Общий объем: ~2000 строк
- Четкое разделение ответственности

## 🚀 РАЗВИТИЕ И РАСШИРЕНИЕ

### **Добавление новых действий:**
1. Создать метод в соответствующем сервисе
2. Добавить обработку в `GameActionService.processAction()`
3. Обновить `BettingService.canPerformAction()`

### **Добавление новых фаз:**
1. Обновить `GameState.status` в типах
2. Добавить логику в `GameStateService.moveToNextPhase()`
3. Создать обработчик в `GameActionService`

### **Оптимизация производительности:**
1. Кэширование состояний в Redis
2. Батчинг операций с базой данных
3. Асинхронная обработка тяжелых операций

---

**Версия**: 1.0  
**Последнее обновление**: 2024  
**Статус**: ✅ Рефакторинг завершен
