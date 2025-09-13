import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../services/redis.service';
import { GameStateService } from '../game/services/game-state.service';
import { Room } from '../../types/game';

@Injectable()
export class SystemRoomsService {
  private readonly logger = new Logger(SystemRoomsService.name);
  private readonly SYSTEM_BETS = [1, 5, 10, 20, 50, 100];

  constructor(
    private readonly redisService: RedisService,
    private readonly gameStateService: GameStateService,
  ) {}

  /**
   * Инициализирует системные комнаты при запуске сервера
   */
  async initializeSystemRooms(): Promise<void> {
    this.logger.log('Initializing system rooms...');
    
    try {
      // Очищаем старые системные комнаты
      await this.cleanupSystemRooms();
      
      // Создаем новые системные комнаты
      for (const minBet of this.SYSTEM_BETS) {
        await this.createSystemRoom(minBet);
      }
      
      this.logger.log(`Successfully initialized ${this.SYSTEM_BETS.length} system rooms`);
    } catch (error) {
      this.logger.error('Failed to initialize system rooms:', error);
      throw error;
    }
  }

  /**
   * Создает системную комнату с указанной минимальной ставкой
   */
  private async createSystemRoom(minBet: number): Promise<void> {
    const roomId = `system_${minBet}`;
    
    const systemRoom: Room = {
      roomId,
      minBet,
      type: 'public',
      players: [],
      spectators: [],
      status: 'waiting',
      maxPlayers: 6,
      createdAt: new Date(),
      isSystem: true,
    };

    // Сохраняем комнату в Redis
    await this.redisService.setRoom(roomId, systemRoom);
    await this.redisService.addToActiveRooms(roomId);

    // Создаем начальное состояние игры
    const initialGameState = this.gameStateService.createInitialGameState(
      roomId,
      minBet,
    );
    await this.redisService.setGameState(roomId, initialGameState);

    this.logger.log(`Created system room: ${roomId} with minBet: $${minBet}`);
  }

  /**
   * Очищает все существующие системные комнаты
   */
  private async cleanupSystemRooms(): Promise<void> {
    this.logger.log('Cleaning up existing system rooms...');
    
    const activeRooms = await this.redisService.getActiveRooms();
    
    for (const roomId of activeRooms) {
      if (roomId.startsWith('system_')) {
        await this.redisService.removeRoom(roomId);
        this.logger.log(`Removed old system room: ${roomId}`);
      }
    }
  }

  /**
   * Получает все системные комнаты
   */
  async getSystemRooms(): Promise<Room[]> {
    const systemRooms: Room[] = [];
    
    for (const minBet of this.SYSTEM_BETS) {
      const roomId = `system_${minBet}`;
      const room = await this.redisService.getRoom(roomId);
      
      if (room) {
        systemRooms.push(room);
      } else {
        // Если системная комната не найдена, пересоздаем её
        this.logger.warn(`System room ${roomId} not found, recreating...`);
        await this.createSystemRoom(minBet);
        const recreatedRoom = await this.redisService.getRoom(roomId);
        if (recreatedRoom) {
          systemRooms.push(recreatedRoom);
        }
      }
    }
    
    return systemRooms;
  }

  /**
   * Проверяет, является ли комната системной
   */
  isSystemRoom(roomId: string): boolean {
    return roomId.startsWith('system_');
  }

  /**
   * Получает минимальные ставки для системных комнат
   */
  getSystemBets(): number[] {
    return [...this.SYSTEM_BETS];
  }
}