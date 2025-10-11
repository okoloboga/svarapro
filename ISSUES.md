# 🐛 ПЛАН ИСПРАВЛЕНИЯ ПРОБЛЕМ

## 🚨 КРИТИЧЕСКИЕ ПРОБЛЕМЫ (ИСПРАВИТЬ СРОЧНО)

### 🔥 ПРОБЛЕМА 1: НЕПРАВИЛЬНАЯ ЛОГИКА ALL-IN ЧЕРЕЗ RAISE
**Приоритет**: КРИТИЧЕСКИЙ  
**Статус**: АКТИВНА - ИГРА ЗАВЕРШАЕТСЯ НЕПРАВИЛЬНО

#### Описание проблемы:
1. **All-in через raise завершает игру неправильно**: Когда игрок делает `raise -> max` (all-in), игра сразу завершается
2. **Неправильный якорь**: Игрок, сделавший all-in через raise, становится якорем, что приводит к немедленному завершению
3. **Нарушение логики Ва-Банк**: Другие игроки не получают возможность ответить на all-in

#### Техническая причина:
**Неправильная установка якоря для all-in через raise:**

```typescript
// ❌ ПРОБЛЕМА: lastRaiseIndex устанавливается для all-in через raise
gameState.lastRaiseIndex = playerIndex; // Игрок становится якорем

// ❌ ПРОБЛЕМА: якорем становится тот же игрок, который сделал all-in
if (gameState.lastRaiseIndex !== undefined) {
  anchorPlayerIndex = gameState.lastRaiseIndex; // Ход возвращается к all-in игроку
}

// ❌ ПРОБЛЕМА: игра завершается, когда ход возвращается к all-in игроку
if (aboutToActPlayerIndex === anchorPlayerIndex) {
  await this.endBettingRound(roomId, gameState); // Игра завершается!
}
```

#### Сценарий воспроизведения:
1. **Игрок 1**: баланс 10
2. **Игрок 2**: баланс 5  
3. **Игрок 2** делает `raise -> max` (all-in на 5)
4. **Игрок 1** НЕ получает ход - игра завершается
5. **Ожидаемое поведение**: Игрок 1 должен получить ход и ответить

#### Правильная логика по GEMINI.md:
1. **All-in через raise** должен устанавливать `isAllIn = true`
2. **НЕ устанавливать** `lastRaiseIndex` (игрок не может больше действовать)
3. **Продолжать игру** с другими игроками
4. **Завершать игру** только когда ход переходит к игроку с балансом 0

#### Файлы с проблемой:
- `server/src/modules/game/services/game.service.ts:827` - установка lastRaiseIndex для all-in
- `server/src/modules/game/services/game.service.ts:881-887` - определение якоря
- `server/src/modules/game/services/game.service.ts:890-891` - завершение круга

#### Решение:
1. **Проверять all-in в raise**: `const isAllInRaise = raiseAmount >= player.balance`
2. **Не устанавливать lastRaiseIndex** для all-in через raise
3. **Устанавливать isAllIn = true** для all-in через raise
4. **Исключать all-in игроков** из якорей
5. **Проверять баланс** перед завершением круга

#### Конкретные исправления:
```typescript
// ✅ ИСПРАВЛЕНИЕ 1: Проверка all-in в raise
const isAllInRaise = raiseAmount >= player.balance;

// ✅ ИСПРАВЛЕНИЕ 2: Устанавливаем lastRaiseIndex только если НЕ all-in
if (!isAllInRaise) {
  gameState.lastRaiseIndex = playerIndex;
}

// ✅ ИСПРАВЛЕНИЕ 3: Устанавливаем isAllIn для all-in через raise
if (isAllInRaise) {
  gameState.players[playerIndex] = this.playerService.updatePlayerStatus(
    updatedPlayer,
    { 
      isAllIn: true,
      hasLookedAndMustAct: false 
    },
  );
}

// ✅ ИСПРАВЛЕНИЕ 4: Исключаем all-in игроков из якорей
if (gameState.lastRaiseIndex !== undefined) {
  const lastRaisePlayer = gameState.players[gameState.lastRaiseIndex];
  if (!lastRaisePlayer.isAllIn) {
    anchorPlayerIndex = gameState.lastRaiseIndex;
  }
}

// ✅ ИСПРАВЛЕНИЕ 5: Проверяем баланс перед завершением
if (aboutToActPlayerIndex === anchorPlayerIndex) {
  const nextPlayer = gameState.players[aboutToActPlayerIndex];
  if (nextPlayer.balance === 0 || nextPlayer.isAllIn) {
    await this.endBettingRound(roomId, gameState);
  } else {
    gameState.currentPlayerIndex = aboutToActPlayerIndex;
  }
}
```

#### Приоритет исправления:
**КРИТИЧЕСКИЙ** - нарушает основную логику игры Ва-Банк

---

## ✅ ИСПРАВЛЕННЫЕ ПРОБЛЕМЫ

### 🔧 ПРОБЛЕМА 2: ДУБЛИРОВАНИЕ WEBSOCKET СООБЩЕНИЙ
**Статус**: ИСПРАВЛЕНО ✅

#### Что было исправлено:
1. **Исправлена защита от дублирования** - используется `client.id` вместо `telegramId`
2. **Добавлена двойная защита** с timestamp
3. **Оптимизирована очистка** таймеров

### 🔧 ПРОБЛЕМА 3: СЛОЖНАЯ АРХИТЕКТУРА
**Статус**: ИСПРАВЛЕНО ✅

#### Что было исправлено:
1. **Заменена сложная архитектура** на монолитную
2. **Удалено 7 микросервисов** - оставлен 1 GameService
3. **Добавлена логика таймеров** в монолитный сервис
4. **Исправлена отправка информации о таймере** клиенту

### 🔧 ПРОБЛЕМА 4: ОТСУТСТВИЕ ТАЙМЕРОВ
**Статус**: ИСПРАВЛЕНО ✅

#### Что было исправлено:
1. **Добавлены таймеры** в монолитный GameService
2. **Информация о таймере** отправляется клиенту через GameState
3. **Автоматический fold** при превышении времени
4. **Правильная очистка** таймеров при завершении игры
