import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from '../../entities/rooms.entity';
import { RedisService } from '../../services/redis.service';
import { TelegramService } from '../../services/telegram.service';
import { v4 as uuidv4 } from 'uuid';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { Room as RoomType } from '../../types/game';

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private roomsRepository: Repository<Room>,
    private redisService: RedisService,
    private telegramService: TelegramService,
  ) {}

  async createRoom(createRoomDto: CreateRoomDto, telegramId: string): Promise<RoomType> {
    const { minBet, type, password } = createRoomDto;
    if (minBet <= 0) {
      throw new BadRequestException('Minimum bet must be positive');
    }
    if (type === 'private' && (!password || !/^\d{6,}$/.test(password))) {
      throw new BadRequestException('Password must be at least 6 digits for private rooms');
    }

    let roomId: string;
    if (type === 'private') {
      roomId = password!;
      const isUnique = await this.redisService.isRoomIdUnique(roomId);
      if (!isUnique) {
        throw new BadRequestException('Password must be unique for private rooms');
      }
    } else {
      roomId = uuidv4();
    }

    const room: RoomType = {
      roomId,
      minBet,
      type,
      players: [telegramId],
      status: 'waiting',
      maxPlayers: 6,
      createdAt: new Date(),
      finishedAt: undefined, 
      ...(type === 'private' && { password }),
    };

    await this.redisService.setRoom(roomId, room);
    await this.redisService.addToActiveRooms(roomId);

    if (type === 'private') {
      try {
        await this.telegramService.sendMessage(
          telegramId,
          `Ваша приватная комната создана! Пароль: *${password}*`,
        );
      } catch (error) {
        console.error('Failed to send Telegram notification:', error);
      }
    }

    await this.redisService.publishRoomUpdate(roomId, room);

    return room;
  }

  async getRooms(): Promise<RoomType[]> {
    const roomIds = await this.redisService.getActiveRooms();
    const rooms: RoomType[] = [];
    for (const roomId of roomIds) {
      const room = await this.redisService.getRoom(roomId);
      if (room && room.type === 'public') {
        rooms.push(room);
      }
    }
    return rooms;
  }

  async getRoom(roomId: string): Promise<RoomType | null> {
    return this.redisService.getRoom(roomId);
  }

  async joinRoom(roomId: string, joinRoomDto: JoinRoomDto): Promise<RoomType> {
    const room = await this.redisService.getRoom(roomId);
    if (!room) {
      throw new BadRequestException('Room not found');
    }
    if (room.status !== 'waiting') {
      throw new BadRequestException('Cannot join room: game already started');
    }
    if (room.players.length >= room.maxPlayers) {
      throw new BadRequestException('Room is full');
    }
    if (room.players.includes(joinRoomDto.telegramId)) {
      throw new BadRequestException('Player already in room');
    }

    room.players.push(joinRoomDto.telegramId);
    await this.redisService.setRoom(roomId, room);
    await this.redisService.publishRoomUpdate(roomId, room);

    return room;
  }

  async finishRoom(roomId: string, winner?: string): Promise<void> {
    const room = await this.redisService.getRoom(roomId);
    if (!room) {
      throw new BadRequestException('Room not found');
    }

    room.status = 'finished';
    room.finishedAt = new Date();
    await this.redisService.setRoom(roomId, room);

    // Сохраняем в Postgres для истории
    const roomEntity = this.roomsRepository.create({
      roomId,
      minBet: room.minBet,
      type: room.type,
      players: room.players,
      createdAt: room.createdAt,
      finishedAt: new Date(),
      winner, // Сохраняем победителя
    });
    await this.roomsRepository.save(roomEntity);

    await this.redisService.removeRoom(roomId);
    await this.redisService.publishRoomUpdate(roomId, room);
  }
}
