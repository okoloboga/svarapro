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
    // Подписка на обновления из Redis
    this.redisService.subscribeToGameUpdates((roomId, gameState) => {
      this.server.to(roomId).emit('game_update', gameState);
    });
  }

  @SubscribeMessage('join_game')
  async handleJoinGame(
    client: Socket,
    payload: { roomId: string },
  ): Promise<void> {
    const { roomId } = payload;
    // @ts-expect-error user is not defined on request
    const userId = client.request.user?.id;
    // @ts-expect-error user is not defined on request
    const userData = client.request.user;

    client.join(roomId); // Присоединяем клиента к комнате сокетов

    if (userId) {
      const result = await this.gameService.joinGame(roomId, userId, userData);
      if (result.success) {
        // Отправляем текущее состояние игры
        client.emit('game_state', result.gameState);
      } else {
        client.emit('error', { message: result.error });
      }
    }
  }

  @SubscribeMessage('leave_room')
  async handleLeaveRoom(
    client: Socket,
    payload: { roomId: string },
  ): Promise<void> {
    // @ts-expect-error user is not defined on request
    const userId = client.request.user?.id;
    if (userId) {
      await this.gameService.leaveRoom(payload.roomId, userId);
      client.leave(payload.roomId);
      const rooms = await this.gameService.getRooms();
      this.server.emit('rooms_updated', rooms);
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
    // @ts-expect-error user is not defined on request
    const userId = client.request.user?.id;

    if (userId) {
      const result = await this.gameService.processAction(
        roomId,
        userId,
        action,
        amount,
      );
      if (!result.success) {
        client.emit('error', { message: result.error });
      }
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    // @ts-expect-error user is not defined on request
    const userId = client.request.user?.id;
    if (userId) {
      // Находим все комнаты пользователя и помечаем его как неактивного
      const rooms = await this.redisService.getPlayerRooms(userId);
      for (const roomId of rooms) {
        await this.gameService.markPlayerInactive(roomId, userId);
      }
    }
  }
}
