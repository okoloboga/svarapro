import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { Room, GameState, GameAction } from '../types/game';

@Injectable()
export class RedisService {
  private client: Redis;

  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'redis',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    });
  }

  async setRoom(roomId: string, room: Room): Promise<void> {
    await this.client.set(`rooms:${roomId}`, JSON.stringify(room));
  }

  async getRoom(roomId: string): Promise<Room | null> {
    const roomData = await this.client.get(`rooms:${roomId}`);
    if (!roomData) {
      return null;
    }
    return JSON.parse(roomData) as Room;
  }

  async addToActiveRooms(roomId: string): Promise<void> {
    await this.client.sadd('active_rooms', roomId);
  }

  async getActiveRooms(): Promise<string[]> {
    return this.client.smembers('active_rooms');
  }

  async removeRoom(roomId: string): Promise<void> {
    await this.client.del(`rooms:${roomId}`);
    await this.client.srem('active_rooms', roomId);
  }

  async publishRoomUpdate(roomId: string, room: Room): Promise<void> {
    await this.client.publish(`room:${roomId}`, JSON.stringify(room));
    if (room.type === 'public') {
      await this.client.publish(
        'rooms',
        JSON.stringify({ action: 'update', room }),
      );
    }
  }

  async isRoomIdUnique(roomId: string): Promise<boolean> {
    const exists = await this.client.sismember('active_rooms', roomId);
    return !exists;
  }

  async subscribeToRoomUpdates(
    callback: (roomId: string, room: Room) => void,
  ): Promise<void> {
    const subClient = this.client.duplicate();
    await subClient.subscribe('rooms');

    subClient.on('message', (channel, message) => {
      if (channel === 'rooms') {
        const data = JSON.parse(message) as { room: Room };
        callback(data.room.roomId, data.room);
      }
    });
  }

  async setGameState(roomId: string, gameState: GameState): Promise<void> {
    await this.client.set(`game:${roomId}`, JSON.stringify(gameState));
  }

  async getGameState(roomId: string): Promise<GameState | null> {
    const gameData = await this.client.get(`game:${roomId}`);
    if (!gameData) {
      return null;
    }
    return JSON.parse(gameData) as GameState;
  }

  async publishGameUpdate(roomId: string, gameState: GameState): Promise<void> {
    await this.client.publish(`game:${roomId}`, JSON.stringify(gameState));
  }

  async subscribeToGameUpdates(
    callback: (roomId: string, gameState: GameState) => void,
  ): Promise<void> {
    const subClient = this.client.duplicate();
    await subClient.psubscribe('game:*');

    subClient.on('pmessage', (pattern, channel, message) => {
      if (pattern === 'game:*') {
        const roomId = channel.split(':')[1];
        const gameState = JSON.parse(message) as GameState;
        callback(roomId, gameState);
      }
    });
  }

  async addPlayerToRoom(roomId: string, playerId: string): Promise<void> {
    await this.client.sadd(`room_players:${roomId}`, playerId);
    await this.client.sadd(`player_rooms:${playerId}`, roomId);
  }

  async removePlayerFromRoom(roomId: string, playerId: string): Promise<void> {
    await this.client.srem(`room_players:${roomId}`, playerId);
    await this.client.srem(`player_rooms:${playerId}`, roomId);
  }

  async getPlayersInRoom(roomId: string): Promise<string[]> {
    return this.client.smembers(`room_players:${roomId}`);
  }

  async getPlayerRooms(playerId: string): Promise<string[]> {
    return this.client.smembers(`player_rooms:${playerId}`);
  }

  async addGameAction(roomId: string, action: GameAction): Promise<void> {
    await this.client.rpush(`game_log:${roomId}`, JSON.stringify(action));
  }

  async getGameActions(roomId: string): Promise<GameAction[]> {
    const actions = await this.client.lrange(`game_log:${roomId}`, 0, -1);
    return actions.map((action) => JSON.parse(action) as GameAction);
  }

  async clearGameData(roomId: string): Promise<void> {
    await this.client.del(`game:${roomId}`);
    await this.client.del(`game_log:${roomId}`);
  }
}
