import { Logger } from '@nestjs/common';
import { Player } from '../../../types/game';

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
  private returnedBets: Map<string, number> = new Map();
  private logger = new Logger(PotManager.name);

  public processBets(players: Player[]) {
    this.reset();
    const activePlayers = players.filter(p => !p.hasFolded && p.totalBet > 0);
    if (activePlayers.length === 0) return;

    activePlayers.forEach(p => {
        this.playerBets.set(p.id, p.totalBet);
    });

    this.calculatePots();
  }

  private calculatePots() {
    this.logger.log(`[calculatePots] Starting pot calculation. Player bets: ${JSON.stringify([...this.playerBets])}`);
    
    const tempPlayerBets = new Map(this.playerBets);

    while (true) {
        const activeBetPlayers = [...tempPlayerBets.entries()].filter(([, bet]) => bet > 0);
        if (activeBetPlayers.length === 0) {
            this.logger.log('[calculatePots] All bets distributed.');
            break;
        }

        // Handle uncalled bets
        if (activeBetPlayers.length === 1) {
            const [lastPlayerId, remainingBet] = activeBetPlayers[0];
            this.logger.log(`[calculatePots] Only one player ${lastPlayerId} has a remaining bet of ${remainingBet}. Returning it.`);
            this.returnedBets.set(lastPlayerId, (this.returnedBets.get(lastPlayerId) || 0) + remainingBet);
            tempPlayerBets.delete(lastPlayerId);
            continue;
        }

        const smallestBet = Math.min(...activeBetPlayers.map(([, bet]) => bet));
        this.logger.log(`[calculatePots] New pot round. Smallest bet level: ${smallestBet}.`);

        const newPot = new Pot();
        newPot.amount = 0;
        
        const contributors = activeBetPlayers.map(([id]) => id);
        this.logger.log(`[calculatePots] Contributors to this pot: ${contributors}`);

        for (const [playerId, playerBet] of this.playerBets.entries()) {
            if (playerBet > 0) { // Only consider players with bets
                const contribution = Math.min(playerBet, smallestBet);
                 if (contributors.includes(playerId)) {
                    newPot.amount += contribution;
                    newPot.eligiblePlayers.add(playerId);
                 }
            }
        }
        
        // This logic is still tricky. Let's try the iterative subtraction method.
        // Reset and try again with the user's logic.
        
        tempPlayerBets.clear();
        this.playerBets.forEach((value, key) => tempPlayerBets.set(key, value));
        this.pots = [];
        this.returnedBets.clear();
        break; // exit to re-run loop with new logic
    }

    // --- Corrected Iterative Logic ---
    const tempBets = new Map(this.playerBets);
    let lastPotLevel = 0;

    const sortedUniqueBets = [...new Set([...tempBets.values()])].sort((a, b) => a - b);

    for (const betLevel of sortedUniqueBets) {
        if (betLevel <= lastPotLevel) continue;

        const pot = new Pot();
        const contribution = betLevel - lastPotLevel;

        for (const [playerId, totalBet] of this.playerBets.entries()) {
            if (totalBet >= betLevel) {
                pot.amount += contribution;
                pot.eligiblePlayers.add(playerId);
            }
        }
        
        if (pot.amount > 0) {
            this.pots.push(pot);
            this.logger.log(`[calculatePots] Created Pot #${this.pots.length - 1}: Amount: ${pot.amount}, Eligible: ${[...pot.eligiblePlayers]}`);
        }
        lastPotLevel = betLevel;
    }

    // Handle returns
    const highestBet = Math.max(...this.playerBets.values());
    const playersWithHighestBet = [...this.playerBets.entries()].filter(([,bet]) => bet === highestBet);
    
    if (playersWithHighestBet.length === 1) {
        const secondHighestBet = Math.max(...[...this.playerBets.values()].filter(bet => bet < highestBet), 0);
        const amountToReturn = highestBet - secondHighestBet;
        if (amountToReturn > 0) {
            const highestBettorId = playersWithHighestBet[0][0];
            this.returnedBets.set(highestBettorId, amountToReturn);
            this.logger.log(`[calculatePots] Returning uncalled bet of ${amountToReturn} to ${highestBettorId}`);
            
            // Adjust the last pot
            const lastPot = this.pots[this.pots.length - 1];
            if (lastPot) {
                lastPot.amount -= amountToReturn;
            }
        }
    }


    this.logger.log(`[calculatePots] Final pots: ${JSON.stringify(this.pots, (key, value) => value instanceof Set ? [...value] : value)}`);
    this.logger.log(`[calculatePots] Returned bets: ${JSON.stringify([...this.returnedBets])}`);
  }

  public getPots(): Pot[] {
    return this.pots;
  }

  public getReturnedBets(): Map<string, number> {
    return this.returnedBets;
  }

  public getWinners(players: Player[]): { potIndex: number; winners: Player[]; amount: number }[] {
    this.logger.log(`[getWinners] Determining winners. Pots: ${JSON.stringify(this.pots, (key, value) => value instanceof Set ? [...value] : value)}`);
    const winnersResult: { potIndex: number; winners: Player[]; amount: number }[] = [];
    
    for (let i = 0; i < this.pots.length; i++) {
      const pot = this.pots[i];
      this.logger.log(`[getWinners] Calculating winner for Pot #${i} (Amount: ${pot.amount})`);
      let bestHandValue = -1;
      let potWinners: Player[] = [];

      const eligiblePlayers = players.filter(p => pot.eligiblePlayers.has(p.id));
      this.logger.log(`[getWinners] Eligible players for Pot #${i}: ${JSON.stringify(eligiblePlayers.map(p => p.id))}`);

      for (const player of eligiblePlayers) {
        const handValue = player.score || 0; // Assuming score is pre-calculated
        this.logger.log(`[getWinners] Player ${player.id} has hand value ${handValue}`);
        if (handValue > bestHandValue) {
          bestHandValue = handValue;
          potWinners = [player];
        } else if (handValue === bestHandValue) {
          potWinners.push(player);
        }
      }
      this.logger.log(`[getWinners] Winner(s) for Pot #${i}: ${JSON.stringify(potWinners.map(p => p.id))}`);
      winnersResult.push({ potIndex: i, winners: potWinners, amount: pot.amount });
    }
    this.logger.log(`[getWinners] Final winners distribution: ${JSON.stringify(winnersResult.map(r => ({...r, winners: r.winners.map(w => w.id)})))}`);
    return winnersResult;
  }

  public reset() {
    this.pots = [];
    this.playerBets.clear();
    this.returnedBets.clear();
    this.logger.log(`[reset] Pot manager cleared.`);
  }
}