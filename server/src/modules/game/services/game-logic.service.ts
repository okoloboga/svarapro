import { Injectable } from '@nestjs/common';
import {
  GameState,
  Player,
  Pot,
  GameAction
} from '../../../types/game';
import { getCardCombination } from '../lib/get-card-combination';
import { UserService } from '../../../modules/user/user.service';
import { TransactionService } from '../../../modules/transaction/transaction.service';
import { GameHistoryService } from './game-history.service';
import { GameHistory } from '../../../entities/game-history.entity';
import { getNextTurnIndex } from '../lib/get-next-turn-index';
import { GameRoomService } from './game-room.service';
import { GameEvent } from '../../../types/game-event.interface';
import { getNewGame } from '../lib/get-new-game';
import { getBlindBettingActions } from '../lib/get-blind-betting-actions';
import { getBettingActions } from '../lib/get-betting-actions';
import { getFinishedActions } from '../lib/get-finished-actions';
import { getAnteActions } from '../lib/get-ante-actions';
import { getPlayerTotalBet } from '../lib/get-player-total-bet';
import { getAmountToCall } from '../lib/get-amount-to-call';

@Injectable()
export class GameLogicService {
  constructor(
    private readonly userService: UserService,
    private readonly transactionService: TransactionService,
    private readonly gameHistoryService: GameHistoryService,
    private readonly gameRoomService: GameRoomService,
  ) {}

  // Placeholder for the missing method
  private async startGame(gameState: GameState): Promise<GameState> {
    // Implement start game logic, e.g., dealing cards and setting initial state
    return gameState;
  }

  async processAction(
    gameState: GameState,
    playerId: string,
    action: string,
    amount?: number,
  ): Promise<{
    updatedState: GameState;
    events: GameEvent[];
  }> {
    let updatedState = { ...gameState };
    const events: GameEvent[] = [];
    const playerIndex = updatedState.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return { updatedState, events };

    switch (action) {
      case 'start_game':
        updatedState = await this.startGame(updatedState);
        break;
      case 'look':
        updatedState = this.handleLook(updatedState, playerIndex);
        break;
      case 'fold':
        updatedState = this.handleFold(updatedState, playerIndex);
        break;
      case 'blind':
        updatedState = await this.handleBlind(updatedState, playerIndex);
        break;
      case 'call':
        updatedState = await this.handleCall(updatedState, playerIndex);
        break;
      case 'raise':
        if (amount !== undefined) {
          updatedState = await this.handleRaise(updatedState, playerIndex, amount);
        }
        break;
      case 'check':
        updatedState = this.handleCheck(updatedState, playerIndex);
        break;
      case 'show_cards':
        updatedState = this.handleShowCards(updatedState, playerId);
        break;
      case 'new_game':
        updatedState = await this.handleNewGame(updatedState);
        break;
      case 'ante':
        if (amount !== undefined) {
          updatedState = await this.handleAnte(updatedState, playerIndex, amount);
        }
        break;
      default:
        break;
    }

    updatedState = this.updatePlayerActions(updatedState);
    updatedState = await this.checkForPhaseTransition(updatedState);
    updatedState = this.updatePlayerActions(updatedState);

    return { updatedState, events };
  }

  private async handleAnte(
    gameState: GameState,
    playerIndex: number,
    amount: number,
  ): Promise<GameState> {
    const player = gameState.players[playerIndex];
    if (!player || player.totalBet >= amount) {
      return gameState;
    }

    const playerEntity = await this.userService.findOneByTelegramId(
      parseInt(player.id, 10),
    );
    if (!playerEntity || playerEntity.balance < amount) {
      return gameState;
    }

    await this.transactionService.create(
      playerEntity,
      -amount,
      'ante',
      'game',
    );
    player.balance -= amount;
    player.totalBet = (player.totalBet || 0) + amount;
    gameState.pot += amount;

    const allAntesIn = gameState.players
      .filter((p) => p.isActive)
      .every((p) => p.totalBet >= gameState.minBet);

    if (allAntesIn) {
      gameState.status = 'blind_betting';
      gameState.currentPlayerIndex = getNextTurnIndex(
        gameState.players,
        gameState.dealerIndex,
        true,
      );
      gameState.lastRaiseIndex = undefined;
      gameState.minBet = gameState.minBet * 2;
    }

    return gameState;
  }

  private async handleBlind(
    gameState: GameState,
    playerIndex: number,
  ): Promise<GameState> {
    const player = gameState.players[playerIndex];
    if (!player) return gameState;

    const amountToBet = gameState.currentBet ? gameState.currentBet * 2 : gameState.minBet;
    const playerEntity = await this.userService.findOneByTelegramId(
      parseInt(player.id, 10),
    );
    if (!playerEntity || playerEntity.balance < amountToBet) return gameState;

    await this.transactionService.create(
      playerEntity,
      -amountToBet,
      'blind_bet',
      'game',
    );
    player.balance -= amountToBet;
    player.totalBet += amountToBet;
    gameState.pot += amountToBet;
    gameState.currentBet = amountToBet;
    gameState.lastRaiseIndex = playerIndex;
    gameState.currentPlayerIndex = getNextTurnIndex(gameState.players, playerIndex);

    return gameState;
  }

  private handleLook(gameState: GameState, playerIndex: number): GameState {
    const player = gameState.players[playerIndex];
    if (player) {
      player.hasLooked = true;
      if (gameState.status === 'blind_betting') {
        const anyBlindBet = gameState.players.some(
          (p) => p.totalBet > 0 && !p.hasLooked,
        );
        if (!anyBlindBet) {
          gameState.status = 'betting';
          gameState.currentBet = 0;
          gameState.lastRaiseIndex = undefined;
          gameState.currentPlayerIndex = getNextTurnIndex(
            gameState.players,
            gameState.dealerIndex,
            true,
          );
        }
      }
    }
    return gameState;
  }

  private handleFold(gameState: GameState, playerIndex: number): GameState {
    const player = gameState.players[playerIndex];
    if (player) {
      player.isActive = false;
      player.hasFolded = true;
      gameState.currentPlayerIndex = getNextTurnIndex(gameState.players, playerIndex);
    }
    return gameState;
  }

  private async handleCall(
    gameState: GameState,
    playerIndex: number,
  ): Promise<GameState> {
    const player = gameState.players[playerIndex];
    if (!player) return gameState;

    const amountToCall = getAmountToCall(gameState, player.id);
    if (amountToCall <= 0) return gameState;

    const playerEntity = await this.userService.findOneByTelegramId(
      parseInt(player.id, 10),
    );
    if (!playerEntity || playerEntity.balance < amountToCall) {
      const allInAmount = playerEntity.balance;
      await this.transactionService.create(
        playerEntity,
        -allInAmount,
        'call_all_in',
        'game',
      );
      player.balance = 0;
      player.totalBet += allInAmount;
      gameState.pot += allInAmount;
      player.isAllIn = true;
    } else {
      await this.transactionService.create(
        playerEntity,
        -amountToCall,
        'call',
        'game',
      );
      player.balance -= amountToCall;
      player.totalBet += amountToCall;
      gameState.pot += amountToCall;
    }

    if (gameState.status === 'blind_betting') {
      gameState.status = 'betting';
      gameState.lastRaiseIndex = playerIndex;
    }

    gameState.currentPlayerIndex = getNextTurnIndex(gameState.players, playerIndex);
    return gameState;
  }

  private async handleRaise(
    gameState: GameState,
    playerIndex: number,
    amount: number,
  ): Promise<GameState> {
    const player = gameState.players[playerIndex];
    if (!player) return gameState;

    const amountToCall = getAmountToCall(gameState, player.id);
    const totalBet = amountToCall + amount;

    const playerEntity = await this.userService.findOneByTelegramId(
      parseInt(player.id, 10),
    );
    if (!playerEntity || playerEntity.balance < totalBet) {
      const allInAmount = playerEntity.balance;
      await this.transactionService.create(
        playerEntity,
        -allInAmount,
        'raise_all_in',
        'game',
      );
      player.balance = 0;
      player.totalBet += allInAmount;
      gameState.pot += allInAmount;
      player.isAllIn = true;
      gameState.currentBet = player.totalBet;
      gameState.lastRaiseIndex = playerIndex;
    } else {
      await this.transactionService.create(
        playerEntity,
        -totalBet,
        'raise',
        'game',
      );
      player.balance -= totalBet;
      player.totalBet += totalBet;
      gameState.pot += totalBet;
      gameState.currentBet = player.totalBet;
      gameState.lastRaiseIndex = playerIndex;
    }

    if (gameState.status === 'blind_betting') {
      gameState.status = 'betting';
    }

    gameState.currentPlayerIndex = getNextTurnIndex(gameState.players, playerIndex);
    return gameState;
  }

  private handleCheck(gameState: GameState, playerIndex: number): GameState {
    gameState.currentPlayerIndex = getNextTurnIndex(gameState.players, playerIndex);
    return gameState;
  }

  private handleShowCards(gameState: GameState, playerId: string): GameState {
    return gameState;
  }

  private async handleNewGame(gameState: GameState): Promise<GameState> {
    const room = await this.gameRoomService.getRoom(gameState.roomId);
    if (!room) return gameState;

    const activePlayers = gameState.players.filter((p) => p.isActive);
    const playerEntities = await this.userService.findMultipleByTelegramIds(
      activePlayers.map((p) => parseInt(p.id, 10)),
    );

    const newGameState = getNewGame(
      gameState.roomId,
      playerEntities,
      room.minBet,
      gameState.players[gameState.dealerIndex]?.id,
    );
    
    const currentDealerId = gameState.players[gameState.dealerIndex]?.id;
    const currentDealerOriginalIndex = newGameState.players.findIndex(p => p.id === currentDealerId);

    newGameState.dealerIndex = getNextTurnIndex(
      newGameState.players,
      currentDealerOriginalIndex,
      false,
    );

    return newGameState;
  }

  private async checkForPhaseTransition(
    gameState: GameState,
  ): Promise<GameState> {
    const activePlayers = gameState.players.filter(
      (p) => p.isActive && !p.hasFolded,
    );
    if (activePlayers.length === 1) {
      return this.finishGame(gameState, activePlayers);
    }

    const bettingFinished = this.isBettingFinished(gameState);

    if (bettingFinished) {
      switch (gameState.status) {
        case 'ante':
          break;
        case 'blind_betting':
          // Переходим в betting только если все игроки либо:
          // 1. Посмотрели карты И сделали ставку (call/raise), ИЛИ
          // 2. Не посмотрели карты (играют вслепую)
          const allPlayersReady = activePlayers.every((p) => {
            if (p.hasLooked) {
              // Если посмотрел карты, должен был сделать ставку
              return p.hasLookedAndMustAct === false; // hasLookedAndMustAct сбрасывается после ставки
            } else {
              // Если не посмотрел, может продолжать играть вслепую
              return true;
            }
          });
          
          if (allPlayersReady) {
            gameState.status = 'betting';
            gameState.currentPlayerIndex = getNextTurnIndex(
              gameState.players,
              gameState.dealerIndex,
              true,
            );
            gameState.currentBet = 0;
            gameState.lastRaiseIndex = undefined;
          }
          break;
        case 'betting':
          return this.finishGame(gameState, activePlayers);
        case 'finished':
          break;
      }
    }

    return gameState;
  }

  private isBettingFinished(gameState: GameState): boolean {
    const activePlayers = gameState.players.filter(
      (p) => p.isActive && !p.hasFolded,
    );
    if (activePlayers.length <= 1) return true;

    const lastRaiserIndex = gameState.lastRaiseIndex;
    if (lastRaiserIndex !== null && lastRaiserIndex !== undefined && gameState.currentPlayerIndex === lastRaiserIndex) {
      return true;
    }

    if (lastRaiserIndex === null || lastRaiserIndex === undefined) {
      const expectedTurnAfterDealer = getNextTurnIndex(
        gameState.players,
        gameState.dealerIndex,
        true,
      );
      if (gameState.currentPlayerIndex === expectedTurnAfterDealer) {
        const allActed = activePlayers.every(
          (p) => getPlayerTotalBet(gameState, p.id) > 0 || p.hasLooked,
        );
        if (allActed) return true;
      }
    }

    const nonAllInPlayers = activePlayers.filter((p) => !p.isAllIn);
    if (nonAllInPlayers.length <= 1) {
      return true;
    }

    const firstPlayerBet = getPlayerTotalBet(
      gameState,
      activePlayers[0].id,
    );
    const allBetsEqual = activePlayers.every(
      (p) =>
        p.isAllIn || getPlayerTotalBet(gameState, p.id) === firstPlayerBet,
    );

    return allBetsEqual && gameState.lastRaiseIndex !== null;
  }

  private async finishGame(
    gameState: GameState,
    activePlayers: Player[],
  ): Promise<GameState> {
    gameState.status = 'finished';

    activePlayers.forEach((p) => {
      const combo = getCardCombination(p.cards);
      p.score = combo.value;
    });

    const { pots, refunds } = this.calculatePots(gameState);
    gameState.pots = pots;

    const winners = this.determineWinners(activePlayers, pots);

    for (const winner of winners) {
      const player = gameState.players.find((p) => p.id === winner.playerId);
      const playerEntity = await this.userService.findOneByTelegramId(
        parseInt(winner.playerId, 10),
      );
      if (player && playerEntity) {
        await this.transactionService.create(
          playerEntity,
          winner.amount,
          'win',
          'game',
        );
        player.balance += winner.amount;
      }
    }

    for (const refund of refunds) {
      const player = gameState.players.find((p) => p.id === refund.playerId);
      const playerEntity = await this.userService.findOneByTelegramId(
        parseInt(refund.playerId, 10),
      );
      if (player && playerEntity && refund.amount > 0) {
        await this.transactionService.create(
          playerEntity,
          refund.amount,
          'refund_overbet',
          'game',
        );
        player.balance += refund.amount;
        player.totalBet -= refund.amount;
        gameState.pot -= refund.amount;
      }
    }

    gameState.winners = activePlayers.filter(p => winners.some(w => w.playerId === p.id));

    const gameHistory = new GameHistory();
    gameHistory.roomId = gameState.roomId;
    gameHistory.pot = gameState.pot;
    gameHistory.players = await this.userService.findMultipleByTelegramIds(
      gameState.players.map((p) => parseInt(p.id, 10)),
    );
    gameHistory.winners = JSON.stringify(winners);
    gameHistory.actions = gameState.log;
    await this.gameHistoryService.create(gameHistory);

    return gameState;
  }

  private calculatePots(gameState: GameState): {
    pots: Pot[];
    refunds: { playerId: string; amount: number }[];
  } {
    const playersInGame = gameState.players.filter((p) => p.totalBet > 0);
    if (playersInGame.length === 0) {
      return { pots: [], refunds: [] };
    }

    const allContributingPlayers = gameState.players.filter(p => p.totalBet > 0 && !p.hasFolded);
    const allBetLevels = [...new Set(allContributingPlayers.map(p => p.totalBet))].sort((a, b) => a - b);

    const potsFinal: Pot[] = [];
    const refundsFinal: { playerId: string; amount: number }[] = [];
    let lastBetLevelFinal = 0;

    for (const level of allBetLevels) {
        const amountToContribute = level - lastBetLevelFinal;
        const contributors = allContributingPlayers.filter(p => p.totalBet >= level);
        
        if (contributors.length > 1) {
            const potAmount = amountToContribute * contributors.length;
            const potKey = contributors.map(p => p.id).sort().join('-');
            let potFound = false;
            for(const pot of potsFinal) {
                if (pot.eligiblePlayers.sort().join('-') === potKey) {
                    pot.amount += potAmount;
                    potFound = true;
                    break;
                }
            }
            if (!potFound) {
                 potsFinal.push({
                    amount: potAmount,
                    eligiblePlayers: contributors.map(p => p.id)
                });
            }
        } else if (contributors.length === 1) {
            refundsFinal.push({ playerId: contributors[0].id, amount: amountToContribute });
        }
        lastBetLevelFinal = level;
    }
    
    return { pots: potsFinal, refunds: refundsFinal };
  }

  private determineWinners(
    players: Player[],
    pots: Pot[],
  ): { playerId: string; amount: number; combination?: string }[] {
    const winners: { playerId: string; amount: number; combination?: string }[] = [];

    for (const pot of pots) {
      const eligiblePlayers = players.filter((p) =>
        pot.eligiblePlayers.includes(p.id),
      );
      if (eligiblePlayers.length === 0) continue;

      let topRank = -1;
      let potWinners: Player[] = [];

      for (const player of eligiblePlayers) {
        if (player.score && player.score > topRank) {
          topRank = player.score;
          potWinners = [player];
        } else if (player.score === topRank) {
          potWinners.push(player);
        }
      }

      const winAmount = pot.amount / potWinners.length;
      for (const winner of potWinners) {
        const existingWinner = winners.find((w) => w.playerId === winner.id);
        if (existingWinner) {
          existingWinner.amount += winAmount;
        } else {
          winners.push({
            playerId: winner.id,
            amount: winAmount,
          });
        }
      }
    }

    return winners;
  }

  private updatePlayerActions(gameState: GameState): GameState {
    const { status, currentPlayerIndex, players } = gameState;
    const currentPlayer = players[currentPlayerIndex];

    if (!currentPlayer) {
      return gameState;
    }

    players.forEach((player, index) => {
      if (index === currentPlayerIndex) {
        switch (status) {
          case 'ante':
            player.availableActions = getAnteActions(gameState, player.id);
            break;
          case 'blind_betting':
            player.availableActions = getBlindBettingActions(
              gameState,
              player.id,
            );
            break;
          case 'betting':
            player.availableActions = getBettingActions(gameState, player.id);
            console.log(`[DEBUG] Actions for ${player.id}:`, JSON.stringify(player.availableActions));
            break;
          case 'finished':
            player.availableActions = getFinishedActions(gameState, player.id);
            break;
          default:
            player.availableActions = [];
        }
      } else {
        player.availableActions = [];
      }
    });

    return gameState;
  }

  private logAction(
    gameState: GameState,
    playerId: string,
    action: string,
    amount?: number,
  ) {
    const actionLog: GameAction = {
      telegramId: playerId,
      type: action as GameAction['type'],
      amount,
      timestamp: Date.now(),
    };
    gameState.log.push(actionLog);
  }
}