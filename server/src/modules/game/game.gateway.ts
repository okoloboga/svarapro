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
    this.redisService.subscribeToGameUpdates((roomId, gameState) => {
      console.log(`Publishing game_update to room ${roomId}:`, gameState);
      this.server.to(roomId).emit('game_update', gameState);
    });
  }

@SubscribeMessage('join_room')
  async handleJoinRoom(
    client: Socket,
    payload: { roomId: string },
  ): Promise<void> {
    const { roomId } = payload;
    // Получаем telegramId из query, auth или headers
    const telegramId = 
      client.handshake.query?.telegramId ||
      client.handshake.auth?.telegramId || 
      client.handshake.headers['x-telegram-id'];
    const userData = client.handshake.auth?.userData || {};

    console.log('Handling join_room:', { roomId, telegramId, userData });

    if (!telegramId) {
      console.error('No telegramId provided for join_room');
      client.emit('error', { message: 'Требуется авторизация (telegramId)' });
      return;
    }

    client.join(roomId); // Присоединяем клиента к комнате сокетов
    console.log(`Client ${telegramId} joined room ${roomId}`);

    const result = await this.gameService.joinRoom(
      roomId,
      telegramId as string,
      userData,
    );
    console.log('join_room result:', result);

    if (result.success) {
      console.log(`Emitting game_state to client ${telegramId} for room ${roomId}`);
      client.emit('game_state', result.gameState);
    } else {
      console.error(`Error in join_room for ${telegramId}:`, result.error);
      client.emit('error', { message: result.error });
    }
  }

  @SubscribeMessage('leave_room')
  async handleLeaveRoom(
    client: Socket,
    payload: { roomId: string },
  ): Promise<void> {
    const telegramId = 
      client.handshake.query?.telegramId ||
      client.handshake.auth?.telegramId || 
      client.handshake.headers['x-telegram-id'];
    console.log('Handling leave_room:', { roomId: payload.roomId, telegramId });

    if (telegramId) {
      await this.gameService.leaveRoom(payload.roomId, telegramId as string);
      client.leave(payload.roomId);
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
    const telegramId = 
      client.handshake.query?.telegramId ||
      client.handshake.auth?.telegramId || 
      client.handshake.headers['x-telegram-id'];
    console.log('Handling game_action:', { roomId, telegramId, action, amount });

    if (telegramId) {
      const result = await this.gameService.processAction(
        roomId,
        telegramId as string,
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
    payload: { roomId: string; position: number; userData: any },
  ): Promise<void> {
    const { roomId, position, userData } = payload;
    const telegramId = 
      client.handshake.query?.telegramId ||
      client.handshake.auth?.telegramId || 
      client.handshake.headers['x-telegram-id'];
    console.log('Handling sit_down:', { roomId, telegramId, position, userData });

    if (telegramId) {
      const result = await this.gameService.sitDown(
        roomId,
        telegramId as string,
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
    const telegramId = 
      client.handshake.query?.telegramId ||
      client.handshake.auth?.telegramId || 
      client.handshake.headers['x-telegram-id'];
    console.log('Client disconnected:', { telegramId });

    if (telegramId) {
      const rooms = await this.redisService.getPlayerRooms(telegramId as string);
      for (const roomId of rooms) {
        console.log(`Player ${telegramId} is leaving room ${roomId} due to disconnect`);
        await this.gameService.leaveRoom(roomId, telegramId as string);
      }
    }
  }
}
