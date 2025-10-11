import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../services/redis.service';
import {
  GameState,
  GameAction,
  Player,
} from '../../../types/game';
import { PlayerService } from './player.service';
import { GameStateService } from './game-state.service';
import { UsersService } from '../../users/users.service';
import { PotManager } from '../lib/pot-manager';
import { SvaraService } from './svara.service';

@Injectable()
export class GameEndService {
  private readonly logger = new Logger(GameEndService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly playerService: PlayerService,
    private readonly gameStateService: GameStateService,
    private readonly usersService: UsersService,
    private readonly svaraService: SvaraService,
  ) {}

  async endBettingRound(
    roomId: string,
    gameState: GameState,
  ): Promise<void> {
    const scoreResult =
      this.gameStateService.calculateScoresForPlayers(gameState);
    gameState = scoreResult.updatedGameState;
    gameState.log.push(...scoreResult.actions);

    // Проверяем количество активных игроков
    const activePlayers = gameState.players.filter((p) => !p.hasFolded);

    if (activePlayers.length === 1) {
      // Если остался только 1 активный игрок - игра заканчивается
      await this.endGameWithWinner(roomId, gameState);
    } else {
      // Если активных игроков больше 1 - переходим к showdown
      const phaseResult = this.gameStateService.moveToNextPhase(
        gameState,
        'showdown',
      );
      gameState = phaseResult.updatedGameState;
      gameState.log.push(...phaseResult.actions);

      await this.redisService.setGameState(roomId, gameState);
      await this.redisService.publishGameUpdate(roomId, gameState);

      // После showdown определяем победителей
      setTimeout(() => {
        this.determineWinnersAfterShowdown(roomId, gameState).catch((error) => {
          console.error(`Error determining winners for room ${roomId}:`, error);
        });
      }, 3000); // Ждем 3 секунды для показа карт в showdown
    }
  }

  async determineWinnersAfterShowdown(
    roomId: string,
    gameState: GameState,
  ): Promise<void> {
    const activePlayers = gameState.players.filter((p) => !p.hasFolded);
    const overallWinners = this.playerService.determineWinners(activePlayers);

    // Рассчитываем выигрыш для каждого победителя
    const rake = Number((gameState.pot * 0.05).toFixed(2));
    const winAmount = gameState.pot - rake;
    const winPerPlayer = Number((winAmount / overallWinners.length).toFixed(2));

    // Устанавливаем lastWinAmount для победителей
    for (const winner of overallWinners) {
      const playerInState = gameState.players.find((p) => p.id === winner.id);
      if (playerInState) {
        playerInState.lastWinAmount = winPerPlayer;
      }
    }

    gameState.winners = overallWinners;

    console.log(
      `[${roomId}] Winners determined after showdown:`,
      overallWinners.map((w) => ({
        id: w.id,
        username: w.username,
        lastWinAmount: gameState.players.find((p) => p.id === w.id)
          ?.lastWinAmount,
      })),
    );

    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);

    // После showdown проверяем, нужна ли свара
    if (overallWinners.length > 1) {
      // Если несколько победителей - объявляем свару
      // Возвращаем флаг для объявления свары
      return;
    } else {
      // Если один победитель - распределяем выигрыш
      await this.distributeWinnings(roomId);
    }
  }

  async endGameWithWinner(
    roomId: string,
    gameState: GameState,
  ): Promise<void> {
    if (!gameState) return;

    const scoreResult =
      this.gameStateService.calculateScoresForPlayers(gameState);
    gameState = scoreResult.updatedGameState;
    gameState.log.push(...scoreResult.actions);

    const activePlayers = gameState.players.filter((p) => !p.hasFolded);
    const overallWinners = this.playerService.determineWinners(activePlayers);

    // Рассчитываем выигрыш для каждого победителя
    const rake = Number((gameState.pot * 0.05).toFixed(2));
    const winAmount = gameState.pot - rake;
    const winPerPlayer = Number((winAmount / overallWinners.length).toFixed(2));

    // Устанавливаем lastWinAmount для победителей
    for (const winner of overallWinners) {
      const playerInState = gameState.players.find((p) => p.id === winner.id);
      if (playerInState) {
        playerInState.lastWinAmount = winPerPlayer;
      }
    }

    // ВСЕГДА сначала переходим в showdown для показа карт
    const phaseResult = this.gameStateService.moveToNextPhase(
      gameState,
      'showdown',
    );
    gameState = phaseResult.updatedGameState;
    gameState.log.push(...phaseResult.actions);
    gameState.winners = overallWinners;

    console.log(
      `[${roomId}] Winners set in endGameWithWinner:`,
      overallWinners.map((w) => ({
        id: w.id,
        username: w.username,
        lastWinAmount: gameState.players.find((p) => p.id === w.id)
          ?.lastWinAmount,
      })),
    );

    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);

    // После showdown проверяем, нужна ли свара
    setTimeout(() => {
      if (overallWinners.length > 1) {
        // Если несколько победителей - объявляем свару
        // Возвращаем флаг для объявления свары
        return;
      } else {
        // Если один победитель - распределяем выигрыш
        this.distributeWinnings(roomId).catch((error) => {
          console.error(
            `Failed to distribute winnings for room ${roomId}:`,
            error,
          );
        });
      }
    }, 3000); // Ждем 3 секунды для показа карт в showdown
  }

  async distributeWinnings(roomId: string): Promise<void> {
    let gameState = await this.redisService.getGameState(roomId);
    if (!gameState) {
      console.error(
        `[distributeWinnings] Game state not found for room ${roomId}`,
      );
      return;
    }

    // Reset lastWinAmount only for non-winners
    for (const p of gameState.players) {
      if (!gameState.winners?.some((w) => w.id === p.id)) {
        p.lastWinAmount = 0;
      }
    }

    const activePlayersWithBets = gameState.players.filter(
      (p) => !p.hasFolded && p.totalBet > 0,
    );
    if (activePlayersWithBets.length === 0 && gameState.pot === 0) {
      // No bets were made, just end the game
      await this.endGame(roomId, gameState, 'no_winner');
      return;
    }

    const potManager = new PotManager();
    // Use all players for processing, as even folded players might be in the pot from ante
    potManager.processBets(gameState.players);

    const refunds = potManager.getReturnedBets();
    const potWinnersList = potManager.getWinners(gameState.players);

    // 1. Process Refunds
    if (refunds.size > 0) {
      for (const [playerId, refundAmount] of refunds.entries()) {
        const player = gameState.players.find((p) => p.id === playerId);
        if (player && refundAmount > 0) {
          player.balance += refundAmount;
          const refundAction: GameAction = {
            type: 'return_bet',
            telegramId: playerId,
            amount: refundAmount,
            timestamp: Date.now(),
            message: `Игроку ${player.username} возвращена не-коллированная ставка ${refundAmount}`,
          };
          gameState.log.push(refundAction);
        }
      }
    }

    // 2. Process Winnings from each pot
    let totalRake = 0;

    // Находим основной банк - самый большой по размеру
    const mainPotIndex = potWinnersList.reduce((maxIndex, pot, index) => {
      return pot.amount > potWinnersList[maxIndex].amount ? index : maxIndex;
    }, 0);

    for (let i = 0; i < potWinnersList.length; i++) {
      const potResult = potWinnersList[i];
      const { winners: potWinnerPlayers, amount } = potResult;

      if (amount <= 0 || potWinnerPlayers.length === 0) {
        continue;
      }

      // Проверяем, является ли это основным банком (самый большой по размеру)
      const isMainPot = i === mainPotIndex;

      if (isMainPot) {
        // Основной банк - проверяем на ничью
        if (potWinnerPlayers.length > 1 && amount > 0) {
          // Ничья в основном банке - объявляем свару (только если банк не пустой)
          console.log(`[${roomId}] Declaring svara for ${potWinnerPlayers.length} winners with pot ${amount}`);
          await this.svaraService.declareSvara(roomId, gameState, potWinnerPlayers);
          return;
        } else if (amount > 0) {
          // Один победитель в основном банке - разыгрываем как обычно
          const rake = Number((amount * 0.05).toFixed(2));
          totalRake += rake;
          const winAmount = amount - rake;

          const winner = potWinnerPlayers[0];
          const playerInState = gameState.players.find(
            (p) => p.id === winner.id,
          );
          if (playerInState) {
            playerInState.balance += winAmount;

            const winAction: GameAction = {
              type: 'win',
              telegramId: winner.id,
              amount: winAmount,
              timestamp: Date.now(),
              message: `Игрок ${playerInState.username} выиграл ${winAmount}`,
            };
            gameState.log.push(winAction);
          }
        } else {
          // Основной банк пустой - завершаем игру без выигрыша
          const noWinAction: GameAction = {
            type: 'join',
            telegramId: 'system',
            timestamp: Date.now(),
            message: 'Основной банк пустой - игра завершена без выигрыша',
          };
          gameState.log.push(noWinAction);
        }
      } else {
        // Боковой банк - разыгрываем сразу
        const rake = Number((amount * 0.05).toFixed(2));
        totalRake += rake;
        const winAmount = amount - rake;
        const winPerPlayer = Number(
          (winAmount / potWinnerPlayers.length).toFixed(2),
        );

        for (const winner of potWinnerPlayers) {
          const playerInState = gameState.players.find(
            (p) => p.id === winner.id,
          );
          if (playerInState) {
            playerInState.balance += winPerPlayer;

            const winAction: GameAction = {
              type: 'win',
              telegramId: winner.id,
              amount: winPerPlayer,
              timestamp: Date.now(),
              message: `Игрок ${playerInState.username} выиграл боковой банк ${winPerPlayer}`,
            };
            gameState.log.push(winAction);
          }
        }
      }
    }

    // Log total rake
    if (totalRake > 0) {
      const rakeAction: GameAction = {
        type: 'join', // Using 'join' for system messages as before
        telegramId: 'system',
        timestamp: Date.now(),
        message: `Общая комиссия: ${totalRake.toFixed(2)}`,
      };
      gameState.log.push(rakeAction);
    }

    // 3. Finalize state (только если свара не объявлена)
    gameState.pot = 0;
    gameState.rake = totalRake;
    // gameState.chipCount = 0;
    // Winners are already set in gameState.winners from endGameWithWinner

    // 4. Persist final balances
    for (const player of gameState.players) {
      await this.usersService.updatePlayerBalance(player.id, player.balance);
      await this.redisService.publishBalanceUpdate(player.id, player.balance);
    }

    // 5. Move to finished state
    const phaseResult = this.gameStateService.moveToNextPhase(
      gameState,
      'finished',
    );
    gameState = phaseResult.updatedGameState;
    gameState.log.push(...phaseResult.actions);

    // Ensure winners are preserved for client animation
    console.log(
      `[${roomId}] Final winners:`,
      gameState.winners?.map((w) => ({
        id: w.id,
        username: w.username,
        lastWinAmount: w.lastWinAmount,
      })),
    );

    await this.redisService.setGameState(roomId, gameState);
    await this.redisService.publishGameUpdate(roomId, gameState);

    this.logger.log(`[${roomId}] Winnings distributed. Ending game.`);
    await this.endGame(roomId, gameState, 'winner');
  }

  async endGame(
    roomId: string,
    gameState: GameState,
    reason: 'winner' | 'no_winner' | 'svara',
  ): Promise<void> {
    const room = await this.redisService.getRoom(roomId);
    if (room) {
      room.status = 'finished';
      room.finishedAt = new Date();
      room.winner =
        reason === 'winner' && gameState.winners
          ? gameState.winners[0]?.id
          : undefined;
      await this.redisService.setRoom(roomId, room);
      await this.redisService.publishRoomUpdate(roomId, room);
    }

    this.logger.log(`[${roomId}] Game ended. Scheduling new game.`);
    setTimeout(() => {
      // Возвращаем флаг для перезапуска игры
      return;
    }, 5000);
  }
}
