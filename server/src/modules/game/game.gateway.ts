import {
  WebSocketGateway,
  SubscribeMessage,
  WebSocketServer,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from './services/game.service';
import { RedisService } from '../../services/redis.service';
import { UserDataDto } from './dto/user-data.dto';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class GameGateway implements OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server: Server;

  // Защита от дублирования действий
  private processingActions = new Map<string, boolean>();

  constructor(
    private readonly gameService: GameService,
    private readonly redisService: RedisService,
  ) {}

  afterInit() {
    void this.redisService.subscribeToGameUpdates((roomId, gameState) => {
      this.server.to(roomId).emit('game_update', gameState);
    });

    // Подписываемся на обновления баланса
    void this.redisService.subscribeToBalanceUpdates((telegramId, balance) => {
      this.server.to(telegramId).emit('balanceUpdated', { balance });
    });

    // Очищаем мертвых игроков при старте сервера
    void this.redisService.cleanupDeadPlayers();
  }

  private getTelegramId(client: Socket): string | undefined {
    const id: unknown =
      client.handshake.query?.telegramId ||
      client.handshake.auth?.telegramId ||
      client.handshake.headers['x-telegram-id'];
    if (Array.isArray(id)) {
      return id[0] as string;
    }
    if (typeof id === 'string') {
      return id;
    }
    return undefined;
  }

  private getUserData(client: Socket): UserDataDto {
    const userData: unknown = client.handshake.auth?.userData || {};
    return userData as UserDataDto;
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    client: Socket,
    payload: { roomId: string },
  ): Promise<void> {
    const { roomId } = payload;
    const telegramId = this.getTelegramId(client);

    if (!telegramId) {
      console.error('No telegramId provided for join_room');
      client.emit('error', { message: 'Требуется авторизация (telegramId)' });
      return;
    }

    void client.join(roomId);

    const result = await this.gameService.joinRoom(roomId, telegramId);

    if (result.success) {
      client.emit('game_state', result.gameState);
    } else {
      console.error(`Error in join_room for ${telegramId}:`, result.error);
      client.emit('error', { message: result.error });
    }
  }

  @SubscribeMessage('subscribe_balance')
  handleSubscribeBalance(client: Socket): void {
    const telegramId = this.getTelegramId(client);

    if (telegramId) {
      void client.join(telegramId);
    } else {
      console.error('No telegramId provided for subscribe_balance');
      client.emit('error', { message: 'Требуется авторизация (telegramId)' });
    }
  }

  @SubscribeMessage('leave_room')
  async handleLeaveRoom(
    client: Socket,
    payload: { roomId: string },
  ): Promise<void> {
    const telegramId = this.getTelegramId(client);

    if (telegramId) {
      await this.gameService.leaveRoom(payload.roomId, telegramId);
      void client.leave(payload.roomId);
      const rooms = await this.gameService.getRooms();
      this.server.emit('rooms_updated', rooms);
    } else {
      console.error('No telegramId provided for leave_room');
      client.emit('error', { message: 'Требуется авторизация (telegramId)' });
    }
  }

  @SubscribeMessage('game_action')
  async handleGameAction(
    client: Socket,
    payload: {
      roomId: string;
      action: string;
      amount?: number;
    },
  ): Promise<void> {
    const { roomId, action, amount } = payload;
    const telegramId = this.getTelegramId(client);
    
    // 🔥 ЗАЩИТА ОТ ДУБЛИРОВАНИЯ
    const actionKey = `${roomId}-${telegramId}-${action}-${amount}-${Date.now()}`;
    if (this.processingActions.has(actionKey)) {
      console.log(`[DUPLICATE_ACTION_BLOCKED] Blocked duplicate action: ${actionKey}`);
      return;
    }
    
    // Более простая защита - по ключу без timestamp
    const simpleKey = `${roomId}-${telegramId}-${action}-${amount}`;
    if (this.processingActions.has(simpleKey)) {
      console.log(`[DUPLICATE_ACTION_BLOCKED] Blocked duplicate action: ${simpleKey}`);
      return;
    }
    
    this.processingActions.set(simpleKey, true);
    
    console.log(`[WEBSOCKET_DEBUG] Received game_action from client ${client.id}, telegramId ${telegramId}, roomId ${roomId}, action ${action}, amount ${amount}`);
    console.log(`[WEBSOCKET_DEBUG] Stack trace:`, new Error().stack?.split('\n').slice(1, 4).join('\n'));

    try {
      if (telegramId) {
      const result = await this.gameService.processAction(
        roomId,
        telegramId,
        action,
        amount,
      );

      if (result.events) {
        result.events.forEach((event) => {
          if (event.to) {
            this.server.to(event.to).emit(event.name, event.payload);
          } else {
            this.server.to(roomId).emit(event.name, event.payload);
          }
        });
      }

      if (!result.success) {
        console.error(`Error in game_action for ${telegramId}:`, result.error);
        client.emit('error', { message: result.error });
      }
    } else {
      console.error('No telegramId provided for game_action');
      client.emit('error', { message: 'Требуется авторизация (telegramId)' });
    }
    } catch (error) {
      console.error('Error in handleGameAction:', error);
      client.emit('error', { message: 'Внутренняя ошибка сервера' });
    } finally {
      // Очищаем ключ через 1 секунду
      setTimeout(() => {
        this.processingActions.delete(simpleKey);
      }, 1000);
    }
  }

  // УДАЛЕНО: WebSocket auto-fold - теперь используется только таймерный auto-fold

  @SubscribeMessage('chat_message')
  handleChatMessage(
    client: Socket,
    payload: { roomId: string; phrase: string },
  ): void {
    const telegramId = this.getTelegramId(client);
    if (!telegramId) {
      client.emit('error', { message: 'Требуется авторизация (telegramId)' });
      return;
    }

    const { roomId, phrase } = payload;

    // Broadcast to all clients in the room, including the sender
    this.server.to(roomId).emit('new_chat_message', {
      playerId: telegramId,
      phrase,
    });
  }

  @SubscribeMessage('sit_down')
  async handleSitDown(
    client: Socket,
    payload: { roomId: string; position: number; userData: UserDataDto },
  ): Promise<void> {
    const { roomId, position, userData } = payload;
    const telegramId = this.getTelegramId(client);

    if (telegramId) {
      const result = await this.gameService.sitDown(
        roomId,
        telegramId,
        position,
        userData,
      );
      if (!result.success) {
        console.error(`Error in sit_down for ${telegramId}:`, result.error);
        client.emit('error', { message: result.error });
      }
    } else {
      console.error('No telegramId provided for sit_down');
      client.emit('error', { message: 'Требуется авторизация (telegramId)' });
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const telegramId = this.getTelegramId(client);

    if (!telegramId) {
      return;
    }

    try {
      const roomIds = await this.redisService.getPlayerRooms(telegramId);
      if (roomIds && roomIds.length > 0) {
        for (const roomId of roomIds) {
          await this.gameService.leaveRoom(roomId, telegramId);
        }
      }
    } catch (error) {
      console.error(
        `[GEMINI] Error during disconnect cleanup for ${telegramId}:`,
        error,
      );
    }
  }
}
