import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  BadRequestException,
  UseGuards,
  Request,
} from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createRoom(@Body() createRoomDto: CreateRoomDto, @Request() req) {
    const telegramId = req.user.telegramId; // Предполагаем, что telegramId есть в JWT
    if (!telegramId) {
      throw new BadRequestException('User telegramId not found');
    }
    return this.roomsService.createRoom(createRoomDto, telegramId);
  }

  @Get()
  async getRooms() {
    return this.roomsService.getRooms();
  }

  @Post(':roomId/join')
  @UseGuards(JwtAuthGuard)
  async joinRoom(@Param('roomId') roomId: string, @Request() req) {
    const telegramId = req.user.telegramId;
    if (!telegramId) {
      throw new BadRequestException('User telegramId not found in token');
    }
    return this.roomsService.joinRoom(roomId, telegramId);
  }

  @Get(':roomId')
  async getRoom(@Param('roomId') roomId: string) {
    const room = await this.roomsService.getRoom(roomId);
    if (!room) {
      throw new BadRequestException('Room not found');
    }
    return room;
  }
}
