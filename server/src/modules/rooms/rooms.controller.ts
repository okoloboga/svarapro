import { Controller, Get, Post, Body, Param, BadRequestException, UseGuards } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createRoom(@Body() createRoomDto: CreateRoomDto) {
    return this.roomsService.createRoom(createRoomDto);
  }

  @Get()
  async getRooms() {
    return this.roomsService.getRooms();
  }

  @Post(':roomId/join')
  @UseGuards(JwtAuthGuard)
  async joinRoom(@Param('roomId') roomId: string, @Body() joinRoomDto: JoinRoomDto) {
    return this.roomsService.joinRoom(roomId, joinRoomDto);
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
