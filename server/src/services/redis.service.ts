import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { Room } from '../types/game';

@Injectable()
export class RedisService {
  private client: Redis;

  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'redis',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    });
  }

  async setRoom(roomId: string, room: Room): Promise<void> {
    await this.client.set(`rooms:${roomId}`, JSON.stringify(room));
  }

  async getRoom(roomId: string): Promise<Room | null> {
    const roomData = await this.client.get(`rooms:${roomId}`);
    return roomData ? JSON.parse(roomData) : null;
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
      await this.client.publish('rooms', JSON.stringify({ action: 'update', room }));
    }
  }

  async isRoomIdUnique(roomId: string): Promise<boolean> {
    const exists = await this.client.sismember('active_rooms', roomId);
    return !exists;
  }

  async subscribeToRoomUpdates(callback: (roomId: string, room: Room) => void): Promise<void> {
    const subClient = this.client.duplicate();
    await subClient.subscribe('rooms');

    subClient.on('message', (channel, message) => {
      if (channel === 'rooms') {
        const { room } = JSON.parse(message);
        callback(room.roomId, room);
      }
    });
  }
}
