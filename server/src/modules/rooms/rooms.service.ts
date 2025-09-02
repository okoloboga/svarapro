import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { RedisService } from '../../services/redis.service';
import { Room } from '../../types/game';
import { CreateRoomDto } from './dto/create-room.dto';
import { GameStateService } from '../game/services/game-state.service';
import { Player } from '../../types/game';
import { UsersService } from '../users/users.service';
import { TelegramService } from '../../services/telegram.service';

@Injectable()
export class RoomsService {
  constructor(
    private readonly redisService: RedisService,
    private readonly gameStateService: GameStateService,
    private readonly usersService: UsersService,
    private readonly telegramService: TelegramService,
  ) {}

  async getRooms(): Promise<Room[]> {
    const roomIds = await this.redisService.getActiveRooms();
    const rooms: Room[] = [];
    for (const roomId of roomIds) {
      const room = await this.redisService.getRoom(roomId);
      if (room) {
        rooms.push(room);
      }
    }
    return rooms;
  }

  async getRoomDetails(roomId: string): Promise<Partial<Room> & { playerCount: number } | null> {
    const room = await this.redisService.getRoom(roomId);
    if (!room) {
      return null;
    }

    return {
      minBet: room.minBet,
      playerCount: room.players.length,
      maxPlayers: room.maxPlayers,
      status: room.status,
    };
  }

  async createRoom(createRoomDto: CreateRoomDto, user: any): Promise<Room> {
    let roomId: string;
    
    if (createRoomDto.type === 'private') {
      // Для приватных комнат ID = пароль
      roomId = createRoomDto.password!;
    } else {
      // Для публичных комнат генерируем случайный 6-значный ID
      roomId = Math.floor(100000 + Math.random() * 900000).toString();
    }
    
    const newRoom: Room = {
      roomId,
      minBet: createRoomDto.minBet,
      type: createRoomDto.type,
      players: [],
      spectators: [],
      status: 'waiting',
      maxPlayers: 6,
      createdAt: new Date(),
      password: createRoomDto.password,
    };

    await this.redisService.setRoom(roomId, newRoom);
    await this.redisService.addToActiveRooms(roomId);

    const initialGameState = this.gameStateService.createInitialGameState(
      roomId,
      createRoomDto.minBet,
    );
    await this.redisService.setGameState(roomId, initialGameState);

    // Отправляем уведомление в Telegram о создании приватной комнаты
    if (createRoomDto.type === 'private' && createRoomDto.password) {
      try {
        const message = `🎮 *Новая приватная комната создана!*\n\n` +
          `🔐 *Пароль:* \`${createRoomDto.password}\`\n` +
          `💰 *Минимальная ставка:* $${createRoomDto.minBet}\n` +
          `👤 *Создатель:* ${user.username || user.firstName}\n\n` +
          `Присоединяйтесь к игре, используя пароль выше!`;
        
        // Отправляем сообщение в чат с ботом
        await this.telegramService.sendMessage(user.telegramId, message);
        
        console.log(`Telegram notification sent for private room ${roomId} to user ${user.telegramId}`);
      } catch (error) {
        console.error(`Failed to send Telegram notification for private room ${roomId}:`, error);
        // Не прерываем создание комнаты из-за ошибки уведомления
      }
    }

    return newRoom;
  }

  async joinRoom(roomId: string, user: any): Promise<Room> {
    // Ищем комнату по ID
    let room = await this.redisService.getRoom(roomId);
    
    if (!room) {
      throw new Error('Room not found');
    }

    if (room.players.includes(user.telegramId)) {
      // User is already in the room, just return the room
      return room;
    }

    if (room.players.length >= room.maxPlayers) {
      // Room is full, add as spectator
      if (!room.spectators.includes(user.telegramId)) {
        room.spectators.push(user.telegramId);
        await this.redisService.setRoom(room.roomId, room);
      }
      return room;
    }

    // Add to room players list, but not to gameState players
    room.players.push(user.telegramId);
    await this.redisService.setRoom(room.roomId, room);

    return room;
  }
}