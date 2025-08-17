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

  constructor(
    private readonly gameService: GameService,
    private readonly redisService: RedisService,
  ) {}

  afterInit() {
    console.log('GameGateway initialized, subscribing to game updates');
    void this.redisService.subscribeToGameUpdates((roomId, gameState) => {
      console.log(`Publishing game_update to room ${roomId}:`, gameState);
      this.server.to(roomId).emit('game_update', gameState);
    });

    // Подписываемся на обновления баланса
    void this.redisService.subscribeToBalanceUpdates((telegramId, balance) => {
      console.log(`Publishing balance_update to user ${telegramId}:`, balance);
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
    const userData = this.getUserData(client);

    console.log('Handling join_room:', { roomId, telegramId, userData });

    if (!telegramId) {
      console.error('No telegramId provided for join_room');
      client.emit('error', { message: 'Требуется авторизация (telegramId)' });
      return;
    }

    void client.join(roomId);
    console.log(`Client ${telegramId} joined room ${roomId}`);

    const result = await this.gameService.joinRoom(
      roomId,
      telegramId,
    );
    console.log('join_room result:', result);

    if (result.success) {
      console.log(
        `Emitting game_state to client ${telegramId} for room ${roomId}`,
      );
      client.emit('game_state', result.gameState);
    } else {
      console.error(`Error in join_room for ${telegramId}:`, result.error);
      client.emit('error', { message: result.error });
    }
  }

  @SubscribeMessage('subscribe_balance')
  handleSubscribeBalance(client: Socket): void {
    const telegramId = this.getTelegramId(client);
    console.log('Handling subscribe_balance:', { telegramId });

    if (telegramId) {
      void client.join(telegramId);
      console.log(`Client ${telegramId} subscribed to balance updates`);
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
    console.log('Handling leave_room:', { roomId: payload.roomId, telegramId });

    if (telegramId) {
      await this.gameService.leaveRoom(payload.roomId, telegramId);
      void client.leave(payload.roomId);
      console.log(`Client ${telegramId} left room ${payload.roomId}`);
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
    console.log('Handling game_action:', {
      roomId,
      telegramId,
      action,
      amount,
    });

    if (telegramId) {
      const result = await this.gameService.processAction(
        roomId,
        telegramId,
        action,
        amount,
      );
      if (!result.success) {
        console.error(`Error in game_action for ${telegramId}:`, result.error);
        client.emit('error', { message: result.error });
      }
    } else {
      console.error('No telegramId provided for game_action');
      client.emit('error', { message: 'Требуется авторизация (telegramId)' });
    }
  }

  @SubscribeMessage('sit_down')
  async handleSitDown(
    client: Socket,
    payload: { roomId: string; position: number; userData: UserDataDto },
  ): Promise<void> {
    const { roomId, position, userData } = payload;
    const telegramId = this.getTelegramId(client);
    console.log('Handling sit_down:', {
      roomId,
      telegramId,
      position,
      userData,
    });

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
    console.log('Client disconnected:', { telegramId });

    if (telegramId) {
      try {
        const rooms = await this.redisService.getPlayerRooms(telegramId);
        console.log(`Player ${telegramId} was in rooms:`, rooms);

        for (const roomId of rooms) {
          console.log(
            `Player ${telegramId} is leaving room ${roomId} due to disconnect`,
          );
          await this.gameService.leaveRoom(roomId, telegramId);
        }
      } catch (error) {
        console.error(
          `Error handling disconnect for player ${telegramId}:`,
          error,
        );
      }
    }
  }
}
