
import { Logger } from '@nestjs/common';
import { Player } from '../services/player.service';

// Represents a single pot
export class Pot {
  amount: number;
  eligiblePlayers: Set<string>; // Set of player IDs

  constructor() {
    this.amount = 0;
    this.eligiblePlayers = new Set();
  }
}

// Manages all pots for a game round
export class PotManager {
  private pots: Pot[] = [];
  private playerBets: Map<string, number> = new Map(); // Total bet per player for the round
  private logger = new Logger(PotManager.name);

  // Add a bet from a player
  addBet(playerId: string, amount: number) {
    const currentBet = this.playerBets.get(playerId) || 0;
    this.playerBets.set(playerId, currentBet + amount);
    this.calculatePots();
  }

  // Handle an all-in situation
  handleAllIn(allInPlayers: { playerId: string; amount: number }[]) {
    this.logger.log(`[All-In] Handling all-in. Initial state: ${JSON.stringify([...this.playerBets])}`);
    allInPlayers.forEach(({ playerId, amount }) => {
      const currentBet = this.playerBets.get(playerId) || 0;
      this.playerBets.set(playerId, currentBet + amount);
    });
    this.logger.log(`[All-In] Player bets after all-in amounts added: ${JSON.stringify([...this.playerBets])}`);
    this.calculatePots();
  }

  // Calculate the main and side pots
  private calculatePots() {
    this.logger.log(`[calculatePots] Starting pot calculation. Current player bets: ${JSON.stringify([...this.playerBets])}`);
    this.pots = [new Pot()];
    const sortedBets = [...this.playerBets.entries()]
      .map(([id, amount]) => ({ id, amount }))
      .sort((a, b) => a.amount - b.amount);

    if (sortedBets.length === 0) {
        this.logger.log('[calculatePots] No bets to process.');
        return;
    }

    this.logger.log(`[calculatePots] Sorted bets for calculation: ${JSON.stringify(sortedBets)}`);

    let lastBetLevel = 0;
    for (const bettor of sortedBets) {
      const betAmount = bettor.amount;
      this.logger.log(`[calculatePots] Processing bettor ${bettor.id} with amount ${betAmount}. Last bet level: ${lastBetLevel}`);
      if (betAmount <= lastBetLevel) {
        this.logger.log(`[calculatePots] Bet amount ${betAmount} is not higher than last level ${lastBetLevel}, skipping.`);
        continue;
      }

      const amountToAdd = betAmount - lastBetLevel;
      this.logger.log(`[calculatePots] Amount to add to pot: ${amountToAdd}`);
      
      let pot = this.pots[this.pots.length - 1];
      if (pot.amount > 0 && pot.eligiblePlayers.size > 0) {
        this.logger.log(`[calculatePots] Current pot is not empty, creating a new side pot.`);
        pot = new Pot();
        this.pots.push(pot);
      }

      for (const [playerId, playerBet] of this.playerBets.entries()) {
        if (playerBet >= betAmount) {
          this.logger.log(`[calculatePots] Player ${playerId} is eligible for this pot level. Adding to pot.`);
          pot.eligiblePlayers.add(playerId);
          pot.amount += amountToAdd;
        }
      }
      lastBetLevel = betAmount;
      this.logger.log(`[calculatePots] Pot state after this level: ${JSON.stringify(this.pots)}. New last bet level: ${lastBetLevel}`);
    }
    this.logger.log(`[calculatePots] Final pots calculated: ${JSON.stringify(this.pots, (key, value) => value instanceof Set ? [...value] : value)}`);
  }

  // Get the winners of each pot
  getWinners(players: Player[]): { potIndex: number; winners: string[]; amount: number }[] {
    this.logger.log(`[getWinners] Determining winners. Pots: ${JSON.stringify(this.pots, (key, value) => value instanceof Set ? [...value] : value)}`);
    const winners = [];
    for (let i = 0; i < this.pots.length; i++) {
      const pot = this.pots[i];
      this.logger.log(`[getWinners] Calculating winner for Pot #${i} (Amount: ${pot.amount})`);
      let bestHandValue = -1;
      let potWinners = [];

      const eligiblePlayers = players.filter(p => pot.eligiblePlayers.has(p.id));
      this.logger.log(`[getWinners] Eligible players for Pot #${i}: ${JSON.stringify(eligiblePlayers.map(p => p.id))}`);

      for (const player of eligiblePlayers) {
        const handValue = player.getHandValue();
        this.logger.log(`[getWinners] Player ${player.id} has hand value ${handValue}`);
        if (handValue > bestHandValue) {
          bestHandValue = handValue;
          potWinners = [player.id];
        } else if (handValue === bestHandValue) {
          potWinners.push(player.id);
        }
      }
      this.logger.log(`[getWinners] Winner(s) for Pot #${i}: ${JSON.stringify(potWinners)}`);
      winners.push({ potIndex: i, winners: potWinners, amount: pot.amount });
    }
    this.logger.log(`[getWinners] Final winners distribution: ${JSON.stringify(winners)}`);
    return winners;
  }

  // Get the total pot size
  getTotalPot(): number {
    return this.pots.reduce((total, pot) => total + pot.amount, 0);
  }

  // Reset the pots for a new round
  reset() {
    this.logger.log(`[reset] Resetting pot manager. All pots and bets will be cleared.`);
    this.pots = [];
    this.playerBets.clear();
  }
}
