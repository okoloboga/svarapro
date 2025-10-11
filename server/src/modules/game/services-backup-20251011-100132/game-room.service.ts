import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../services/redis.service';
import {
  GameState,
  GameAction,
  GameActionResult,
  Room,
  Player,
} from '../../../types/game';
import { PlayerService } from './player.service';
import { UsersService } from '../../users/users.service';
import { UserDataDto } from '../dto/user-data.dto';

@Injectable()
export class GameRoomService {
  private readonly logger = new Logger(GameRoomService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly playerService: PlayerService,
    private readonly usersService: UsersService,
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

  async leaveRoom(roomId: string, telegramId: string): Promise<void> {
    const room = await this.redisService.getRoom(roomId);
    const gameState = await this.redisService.getGameState(roomId);

    if (room) {
      room.players = room.players.filter((pId) => pId !== telegramId);
      if (room.players.length === 0) {
        await this.redisService.removeRoom(roomId);
        await this.redisService.clearGameData(roomId);
        await this.redisService.publishRoomUpdate(roomId, null);
      } else {
        await this.redisService.setRoom(roomId, room);
        await this.redisService.publishRoomUpdate(roomId, room);
      }
    }

    if (gameState) {
      const playerIndex = gameState.players.findIndex(
        (p) => p.id === telegramId,
      );

      if (playerIndex > -1) {
        const removedPlayer = gameState.players[playerIndex];
        gameState.players.splice(playerIndex, 1);

        try {
          await this.usersService.updatePlayerBalance(
            telegramId,
            removedPlayer.balance,
          );
          await this.redisService.publishBalanceUpdate(
            telegramId,
            removedPlayer.balance,
          );
        } catch (error) {
          console.error(
            `Failed to save balance for leaving player ${telegramId}:`,
            error,
          );
        }

        const action: GameAction = {
          type: 'leave',
          telegramId,
          timestamp: Date.now(),
          message: `Игрок ${removedPlayer.username} покинул стол`,
        };
        gameState.log.push(action);

        const activePlayers = gameState.players.filter(
          (p) => p.isActive && !p.hasFolded && p.balance > 0,
        );
        const activeStatuses = ['ante', 'blind_betting', 'betting', 'showdown'];

        if (
          activePlayers.length === 1 &&
          activeStatuses.includes(gameState.status)
        ) {
          await this.redisService.setGameState(roomId, gameState);
          await this.redisService.publishGameUpdate(roomId, gameState);
          // Возвращаем флаг для завершения игры
          return;
        }

        await this.redisService.setGameState(roomId, gameState);
        await this.redisService.publishGameUpdate(roomId, gameState);
      }
    }

    await this.redisService.removePlayerFromRoom(roomId, telegramId);
  }

  async joinRoom(
    roomId: string,
    telegramId: string,
  ): Promise<GameActionResult> {
    const room = await this.redisService.getRoom(roomId);
    if (!room) {
      return { success: false, error: 'Комната не найдена' };
    }

    if (!room.players.includes(telegramId)) {
      room.players.push(telegramId);
      await this.redisService.setRoom(roomId, room);
      await this.redisService.addPlayerToRoom(roomId, telegramId);
      await this.redisService.publishRoomUpdate(roomId, room);
    }

    let gameState: GameState | null;
    try {
      gameState = await this.redisService.getGameState(roomId);
      if (!gameState) {
        console.error(
          `[joinRoom] Game state not found for room ${roomId}, user ${telegramId}`,
        );
        return { success: false, error: 'Игра не найдена' };
      }
    } catch (error) {
      console.error(
        `[joinRoom] Redis error getting game state for room ${roomId}, user ${telegramId}:`,
        error,
      );
      return {
        success: false,
        error: 'Ошибка подключения к серверу. Попробуйте еще раз.',
      };
    }

    return { success: true, gameState };
  }

  async sitDown(
    roomId: string,
    telegramId: string,
    position: number,
    userData: UserDataDto,
  ): Promise<GameActionResult> {
    let gameState: GameState | null;
    try {
      gameState = await this.redisService.getGameState(roomId);
      if (!gameState) {
        console.error(
          `[sitDown] Game state not found for room ${roomId}, user ${telegramId}`,
        );
        return { success: false, error: 'Игра не найдена' };
      }
    } catch (error) {
      console.error(
        `[sitDown] Redis error getting game state for room ${roomId}, user ${telegramId}:`,
        error,
      );
      return {
        success: false,
        error: 'Ошибка подключения к серверу. Попробуйте еще раз.',
      };
    }

    if (gameState.players.some((p) => p.position === position)) {
      return { success: false, error: 'Это место уже занято' };
    }

    if (gameState.players.some((p) => p.id === telegramId)) {
      return { success: false, error: 'Вы уже сидите за столом' };
    }

    const userProfile = await this.usersService.getProfile(telegramId);

    if (userProfile.balance < gameState.minBet) {
      return { success: false, gameState };
    }
    const isGameInProgress = gameState.status !== 'waiting';
    const newPlayer = this.playerService.createPlayer(
      telegramId,
      userData,
      position,
      userProfile.balance,
      !isGameInProgress,
    );
    gameState.players.push(newPlayer);

    const action: GameAction = {
      type: 'join',
      telegramId,
      timestamp: Date.now(),
      message: `Игрок ${newPlayer.username} сел за стол на позицию ${position}`,
    };
    gameState.log.push(action);

    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);

    const room = await this.redisService.getRoom(roomId);
    if (room && gameState.players.length >= 2 && room.status === 'waiting') {
      // Возвращаем флаг для старта игры
      return { success: true, gameState, shouldStartGame: true };
    }

    return { success: true, gameState };
  }
}