# 🐛 ПЛАН ИСПРАВЛЕНИЯ ПРОБЛЕМ

## 🚨 КРИТИЧЕСКИЕ ПРОБЛЕМЫ (ИСПРАВИТЬ СРОЧНО)

### 🔥 ПРОБЛЕМА 0: ДУБЛИРОВАНИЕ ДЕЙСТВИЙ В WEBSOCKET
**Приоритет**: КРИТИЧЕСКИЙ  
**Статус**: АКТИВНА - ЗАЩИТА НЕ РАБОТАЕТ

#### Описание проблемы:
1. **Дублирование WebSocket сообщений**: Каждое действие игрока обрабатывается **ДВАЖДЫ** на сервере
2. **Защита от дублирования не срабатывает**: Логи показывают отсутствие `[DUPLICATE_ACTION_BLOCKED]`
3. **Look -> Raise/Call зацикливание**: Из-за дублирования ход возвращается к тому же игроку

#### Техническая причина:
**Защита от дублирования не работает из-за неправильного ключа:**

```typescript
// Текущая защита (НЕ РАБОТАЕТ):
const simpleKey = `${roomId}-${telegramId}-${action}-${amount}`;
// Проблема: amount может быть undefined, ключ одинаковый для дублированных действий

// Логи показывают:
[WEBSOCKET_DEBUG] Received game_action from client cIwhpFexW_NGkiWiAAAJ, telegramId 5101525651, roomId 0001, action look, amount undefined
[WEBSOCKET_DEBUG] Received game_action from client cIwhpFexW_NGkiWiAAAJ, telegramId 5101525651, roomId 0001, action look, amount undefined  ← ДУБЛИРОВАНИЕ!
```

#### Логика проблемы:
1. **Клиент отправляет дублированные сообщения**: 
   - WebSocket соединение может дублироваться
   - Каждое действие отправляется дважды
   - Сервер получает два одинаковых сообщения

2. **Защита от дублирования не срабатывает**:
   - Ключ дублирования одинаковый для обоих сообщений
   - `amount = undefined` в обоих случаях
   - Второе сообщение проходит защиту

3. **Результат дублирования**:
   - Каждое действие выполняется дважды
   - Ход переходит к следующему игроку дважды
   - Возвращается к исходному игроку
   - **Look -> Raise/Call зацикливание**

#### Файлы с проблемой:
- `server/src/modules/game/game.gateway.ts:139-145` - Защита от дублирования не работает
- `client/src/App.tsx:224-246` - Возможное дублирование WebSocket соединений
- `client/src/services/websocket.ts:15-75` - WebSocket инициализация

#### Решение:
1. **Исправить ключ дублирования** - использовать `client.id` вместо `telegramId`:
   ```typescript
   const clientKey = `${client.id}-${action}-${amount || 'null'}`;
   ```

2. **Добавить timestamp в ключ** - для более надежной защиты:
   ```typescript
   const actionKey = `${client.id}-${action}-${Date.now()}`;
   ```

3. **Уменьшить время очистки** - с 1000ms до 500ms:
   ```typescript
   setTimeout(() => {
     this.processingActions.delete(clientKey);
   }, 500);
   ```

4. **Проверить клиент** - убедиться, что WebSocket не дублируется

#### Добавлено логирование:
- `[WEBSOCKET_DEBUG]` - для диагностики входящих сообщений
- `[DUPLICATE_ACTION_BLOCKED]` - для диагностики блокировки дублирования
- `[PROCESS_ACTION_DEBUG]` - для диагностики обработки действий
- `[GAME_ACTION_DEBUG]` - для диагностики GameActionService

#### Детальный анализ:
**Проблема в защите от дублирования:**

```typescript
// Текущая защита (НЕ РАБОТАЕТ):
const simpleKey = `${roomId}-${telegramId}-${action}-${amount}`;
// Проблема: amount = undefined, ключ одинаковый для дублированных действий

// Логи показывают дублирование:
[WEBSOCKET_DEBUG] Received game_action from client cIwhpFexW_NGkiWiAAAJ, telegramId 5101525651, roomId 0001, action look, amount undefined
[WEBSOCKET_DEBUG] Received game_action from client cIwhpFexW_NGkiWiAAAJ, telegramId 5101525651, roomId 0001, action look, amount undefined  ← ДУБЛИРОВАНИЕ!
```

**Правильная защита должна быть:**
```typescript
// Использовать client.id вместо telegramId:
const clientKey = `${client.id}-${action}-${amount || 'null'}`;

// Или добавить timestamp:
const actionKey = `${client.id}-${action}-${Date.now()}`;
```

#### Анализ логов (ПОДТВЕРЖДЕНО):
**Дублирование WebSocket сообщений:**
```
[WEBSOCKET_DEBUG] Received game_action from client cIwhpFexW_NGkiWiAAAJ, telegramId 5101525651, roomId 0001, action look, amount undefined
[WEBSOCKET_DEBUG] Received game_action from client cIwhpFexW_NGkiWiAAAJ, telegramId 5101525651, roomId 0001, action look, amount undefined  ← ДУБЛИРОВАНИЕ!
```
**ПРОБЛЕМА**: Каждое действие приходит **ДВАЖДЫ** - защита не срабатывает!

**Отсутствие блокировки дублирования:**
```
// НЕТ ЛОГОВ [DUPLICATE_ACTION_BLOCKED] - защита не работает!
```
**ПРОБЛЕМА**: Защита от дублирования не срабатывает, все действия проходят дважды!

#### Сценарии воспроизведения:
1. **Дублирование действий**: Любое действие игрока выполняется дважды из-за дублированных WebSocket сообщений
2. **Look -> Raise зацикливание**: Игрок делает `look` → `raise`, но из-за дублирования ход возвращается к нему
3. **Look -> Call блокировка**: Игрок делает `look` → `call`, но из-за дублирования игра застревает в `blind_betting`

#### Приоритет исправления:
**КРИТИЧЕСКИЙ** - игра полностью неработоспособна из-за дублирования действий

#### Конкретные исправления:
1. **Исправить ключ дублирования** - в `GameGateway.handleGameAction()`:
   ```typescript
   // ❌ ТЕКУЩИЙ (НЕ РАБОТАЕТ):
   const simpleKey = `${roomId}-${telegramId}-${action}-${amount}`;
   
   // ✅ ИСПРАВЛЕННЫЙ:
   const clientKey = `${client.id}-${action}-${amount || 'null'}`;
   ```

2. **Добавить timestamp в ключ** - для более надежной защиты:
   ```typescript
   const actionKey = `${client.id}-${action}-${Date.now()}`;
   ```

3. **Уменьшить время очистки** - с 1000ms до 500ms:
   ```typescript
   setTimeout(() => {
     this.processingActions.delete(clientKey);
   }, 500);
   ```

4. **Проверить клиент** - убедиться, что WebSocket не дублируется

---

## ✅ ИСПРАВЛЕННЫЕ ПРОБЛЕМЫ

### 🔧 ПРОБЛЕМА 1: ДВОЙНОЕ WEBSOCKET ПОДКЛЮЧЕНИЕ В КЛИЕНТЕ
**Статус**: ИСПРАВЛЕНО ✅

#### Что было исправлено:
1. **Убрано двойное WebSocket подключение** в `App.tsx`
2. **Объединена WebSocket логика** в `websocket.ts` с поддержкой баланса
3. **Добавлены обработчики баланса** через CustomEvent для связи с App.tsx
4. **Устранено дублирование** - теперь только одно соединение на клиент

#### Файлы изменены:
- `client/src/App.tsx` - убрано создание `socketInstance`
- `client/src/services/websocket.ts` - добавлены обработчики баланса

### 🔧 ПРОБЛЕМА 2: ОШИБКА TYPESCRIPT В USERDATA
**Статус**: ИСПРАВЛЕНО ✅

#### Что было исправлено:
```typescript
// ❌ БЫЛО:
avatar: profile.avatar || '',

// ✅ СТАЛО:
photo_url: profile.avatar || '',
```

#### Причина:
В типе `UserData` определено поле `photo_url`, а не `avatar`

---

## 🚨 КРИТИЧЕСКИЕ ПРОБЛЕМЫ (ИСПРАВИТЬ СРОЧНО)
