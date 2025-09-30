import { Injectable } from '@nestjs/common';

@Injectable()
export class GameRoomService {
  getRoom(roomId: string): Promise<any> {
    return Promise.resolve({ minBet: 10 });
  }
}
