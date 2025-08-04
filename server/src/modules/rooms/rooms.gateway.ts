import { SubscribeMessage, WebSocketGateway, WebSocketServer, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RoomsService } from './rooms.service';
import { RedisService } from '../../services/redis.service'; // Импортируем RedisService
import { Room } from '../../types/game';

@WebSocketGateway({ cors: { origin: '*' } })
export class RoomsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly roomsService: RoomsService,
    private readonly redisService: RedisService, // Инжектируем RedisService
  ) {}

  afterInit(server: Server) {
    console.log('Subscribing to room updates');
    this.redisService.subscribeToRoomUpdates((roomId, room) => {
      console.log('Received room update from Redis:', roomId, room);
      this.server.emit('room_update', { roomId, room });
    });
  }

  async handleConnection(client: Socket) {
    const rooms = await this.roomsService.getRooms();
    client.emit('rooms', { action: 'initial', rooms });
  }

  handleDisconnect(client: Socket) {
    // Можно добавить логику при отключении клиента
  }

  @SubscribeMessage('request_rooms')
  async handleRequestRooms(client: Socket) {
    const rooms = await this.roomsService.getRooms();
    client.emit('rooms', { action: 'initial', rooms });
  }

  // Метод для рассылки обновленного списка комнат всем клиентам
  async broadcastRoomsUpdate() {
    const rooms = await this.roomsService.getRooms();
    this.server.emit('rooms', { action: 'update', rooms });
  }
}
