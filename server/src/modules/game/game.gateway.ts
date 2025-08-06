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
    const telegramId = client.request.user?.telegramId;
    // @ts-expect-error user is not defined on request
    const userData = client.request.user;

    client.join(roomId); // Присоединяем клиента к комнате сокетов

    if (telegramId) {
      const result = await this.gameService.joinGame(
        roomId,
        telegramId,
        userData,
      );
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
    const telegramId = client.request.user?.telegramId;
    if (telegramId) {
      await this.gameService.leaveRoom(payload.roomId, telegramId);
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
    const telegramId = client.request.user?.telegramId;

    if (telegramId) {
      const result = await this.gameService.processAction(
        roomId,
        telegramId,
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
    const telegramId = client.request.user?.telegramId;
    if (telegramId) {
      // Находим все комнаты пользователя и помечаем его как неактивного
      const rooms = await this.redisService.getPlayerRooms(telegramId);
      for (const roomId of rooms) {
        await this.gameService.markPlayerInactive(roomId, telegramId);
      }
    }
  }
  // Добавьте этот обработчик в класс GameGateway

  @SubscribeMessage('sit_down')
  async handleSitDown(
    client: Socket,
    payload: { roomId: string; position: number },
  ): Promise<void> {
    const { roomId, position } = payload;
    // @ts-expect-error user is not defined on request
    const telegramId = client.request.user?.telegramId;

    if (telegramId) {
      const result = await this.gameService.sitDown(
        roomId,
        telegramId,
        position,
      );
      if (!result.success) {
        client.emit('error', { message: result.error });
      }
    }
  }
}
