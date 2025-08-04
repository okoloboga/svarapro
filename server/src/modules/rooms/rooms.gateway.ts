import { SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { RoomsService } from './rooms.service';
import { Room } from '../../types/game';

@WebSocketGateway({ cors: { origin: '*' } })
export class RoomsGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly roomsService: RoomsService) {}

  async handleConnection(client: any) {
    // Отправляем начальный список публичных комнат при подключении
    const rooms = await this.roomsService.getRooms();
    client.emit('rooms', { action: 'initial', rooms });
  }

  @SubscribeMessage('request_rooms')
  async handleRequestRooms(client: any) {
    // Ответ на запрос списка комнат
    const rooms = await this.roomsService.getRooms();
    client.emit('rooms', { action: 'initial', rooms });
  }
}
