import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../services/redis.service';
import {
  GameState,
  GameAction,
  Room,
} from '../../../types/game';
import { GameStateService } from './game-state.service';
import { PlayerService } from './player.service';
import { BettingService } from './betting.service';
import { CardService } from './card.service';

@Injectable()
export class GameLifecycleService {
  private readonly logger = new Logger(GameLifecycleService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly gameStateService: GameStateService,
    private readonly playerService: PlayerService,
    private readonly bettingService: BettingService,
    private readonly cardService: CardService,
  ) {}

  async startGame(roomId: string): Promise<void> {
    const room = await this.redisService.getRoom(roomId);
    if (!room || (room.status !== 'waiting' && room.status !== 'finished')) {
      return;
    }

    if (room.status === 'waiting') {
      // await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    const gameState = await this.redisService.getGameState(roomId);

    if (room.status === 'finished' && gameState) {
      const minBalance = room.minBet;
      gameState.players = gameState.players.filter(
        (p) => p.balance >= minBalance,
      );
    }

    if (!gameState || gameState.players.length < 2) {
      room.status = 'waiting';
      await this.redisService.setRoom(roomId, room);
      if (gameState) {
        const newGameState = this.gameStateService.createInitialGameState(
          roomId,
          room.minBet,
        );
        newGameState.players = gameState.players.map((p) =>
          this.playerService.resetPlayerForNewGame(p, false),
        );
        await this.redisService.setGameState(roomId, newGameState);
        await this.redisService.publishGameUpdate(roomId, newGameState);
      }
      await this.redisService.publishRoomUpdate(roomId, room);
      return;
    }

    room.status = 'playing';
    await this.redisService.setRoom(roomId, room);
    await this.redisService.publishRoomUpdate(roomId, room);

    const { updatedGameState, actions } =
      this.gameStateService.initializeNewGame(gameState, room.winner);

    const finalGameState = updatedGameState;
    finalGameState.log.push(...actions);

    await this.redisService.setGameState(roomId, finalGameState);
    await this.redisService.publishGameUpdate(roomId, finalGameState);

    await this.startAntePhase(roomId);
  }

  async startAntePhase(roomId: string): Promise<void> {
    let gameState = await this.redisService.getGameState(roomId);
    if (!gameState || gameState.status !== 'ante') {
      return;
    }

    // ИСПРАВЛЕНИЕ: Проверяем случай свары с недостатком средств
    if (gameState.isSvara) {
      const svaraParticipants = gameState.players.filter(
        (p) => gameState!.svaraParticipants?.includes(p.id) && p.isActive,
      );

      // Если у участников свары нет денег для анте, делим банк пополам
      const participantsWithoutMoney = svaraParticipants.filter(
        (p) => p.balance < gameState!.minBet,
      );
      if (
        participantsWithoutMoney.length === svaraParticipants.length &&
        svaraParticipants.length === 2
      ) {
        const winAmount = Number((gameState.pot / 2).toFixed(2));
        const rake = Number((gameState.pot * 0.05).toFixed(2));

        for (const participant of svaraParticipants) {
          const playerIndex = gameState.players.findIndex(
            (p) => p.id === participant.id,
          );
          if (playerIndex !== -1) {
            gameState.players[playerIndex].balance += winAmount;

            const action: GameAction = {
              type: 'win',
              telegramId: participant.id,
              amount: winAmount,
              timestamp: Date.now(),
              message: `Игрок ${participant.username} получил ${winAmount} в сваре (недостаток средств)`,
            };
            gameState.log.push(action);
          }
        }

        // Добавляем действие о комиссии
        if (rake > 0) {
          const action: GameAction = {
            type: 'join',
            telegramId: 'system',
            timestamp: Date.now(),
            message: `Комиссия: ${rake}`,
          };
          gameState.log.push(action);
        }

        // Завершаем игру
        gameState.pot = 0;
        gameState.status = 'finished';
        gameState.winners = svaraParticipants;

        await this.redisService.setGameState(roomId, gameState);
        await this.redisService.publishGameUpdate(roomId, gameState);
        return;
      }
    }

    const { updatedGameState, actions } = this.bettingService.processAnte(
      gameState,
      gameState.minBet,
    );
    gameState = updatedGameState;
    gameState.log.push(...actions);

    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);

    const activePlayers = gameState.players.filter((p) => p.isActive);
    if (activePlayers.length < 2) {
      // Возвращаем флаг для завершения игры
      return;
    }

    const dealResult = this.gameStateService.dealCardsToPlayers(gameState);
    gameState = dealResult.updatedGameState;
    gameState.log.push(...dealResult.actions);

    // Сохраняем состояние с разданными картами
    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);

    // Ждем завершения анимации раздачи карт на клиенте (3 секунды)
    // await new Promise((resolve) => setTimeout(resolve, 3000));

    // Только после завершения анимации переходим в blind_betting
    const phaseResult = this.gameStateService.moveToNextPhase(
      gameState,
      'blind_betting',
    );
    gameState = phaseResult.updatedGameState;
    gameState.log.push(...phaseResult.actions);

    gameState.currentPlayerIndex = this.playerService.findNextActivePlayer(
      gameState.players,
      gameState.dealerIndex,
    );
    // Устанавливаем время начала хода
    gameState.turnStartTime = Date.now();

    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);

    // Возвращаем информацию о том, что нужно запустить таймер
    return;
  }
}
