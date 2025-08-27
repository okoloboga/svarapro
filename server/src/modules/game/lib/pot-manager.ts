
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
    console.log(
      `[calculatePots] Starting pot calculation. Player bets: ${JSON.stringify(
        [...this.playerBets],
      )}`,
    );

    const tempBets = new Map(this.playerBets);
    let lastPotLevel = 0;

    const sortedUniqueBets = [...new Set([...tempBets.values()])].sort(
      (a, b) => a - b,
    );

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
        console.log(
          `[calculatePots] Created Pot #${this.pots.length - 1}: Amount: ${
            pot.amount
          }, Eligible: ${[...pot.eligiblePlayers]}`,
        );
      }
      lastPotLevel = betLevel;
    }

    // Handle uncalled bet returns
    const allBets = [...this.playerBets.values()];
    const highestBet = Math.max(...allBets, 0);
    const playersWithHighestBet = [...this.playerBets.entries()].filter(
      ([, bet]) => bet === highestBet,
    );

    if (playersWithHighestBet.length === 1) {
      const secondHighestBet = Math.max(
        ...allBets.filter((bet) => bet < highestBet),
        0,
      );
      const amountToReturn = highestBet - secondHighestBet;

      if (amountToReturn > 0) {
        const highestBettorId = playersWithHighestBet[0][0];
        this.returnedBets.set(highestBettorId, amountToReturn);
        console.log(
          `[calculatePots] Returning uncalled bet of ${amountToReturn} to ${highestBettorId}`,
        );

        // Adjust the last pot amount
        const lastPot = this.pots[this.pots.length - 1];
        if (lastPot) {
          lastPot.amount -= amountToReturn;
        }
      }
    }

    console.log(
      `[calculatePots] Final pots: ${JSON.stringify(
        this.pots,
        (key, value) => (value instanceof Set ? [...value] : value),
      )}`,
    );
    console.log(
      `[calculatePots] Returned bets: ${JSON.stringify([...this.returnedBets])}`,
    );
  }

  public getPots(): Pot[] {
    return this.pots;
  }

  public getReturnedBets(): Map<string, number> {
    return this.returnedBets;
  }

  public getWinners(players: Player[]): { potIndex: number; winners: Player[]; amount: number }[] {
    console.log(`[getWinners] Determining winners. Pots: ${JSON.stringify(this.pots, (key, value) => value instanceof Set ? [...value] : value)}`);
    const winnersResult: { potIndex: number; winners: Player[]; amount: number }[] = [];
    
    for (let i = 0; i < this.pots.length; i++) {
      const pot = this.pots[i];
      console.log(`[getWinners] Calculating winner for Pot #${i} (Amount: ${pot.amount})`);
      let bestHandValue = -1;
      let potWinners: Player[] = [];

      const eligiblePlayers = players.filter(p => pot.eligiblePlayers.has(p.id));
      console.log(`[getWinners] Eligible players for Pot #${i}: ${JSON.stringify(eligiblePlayers.map(p => p.id))}`);

      for (const player of eligiblePlayers) {
        const handValue = player.score || 0; // Assuming score is pre-calculated
        console.log(`[getWinners] Player ${player.id} has hand value ${handValue}`);
        if (handValue > bestHandValue) {
          bestHandValue = handValue;
          potWinners = [player];
        } else if (handValue === bestHandValue) {
          potWinners.push(player);
        }
      }
      console.log(`[getWinners] Winner(s) for Pot #${i}: ${JSON.stringify(potWinners.map(p => p.id))}`);
      winnersResult.push({ potIndex: i, winners: potWinners, amount: pot.amount });
    }
    console.log(`[getWinners] Final winners distribution: ${JSON.stringify(winnersResult.map(r => ({...r, winners: r.winners.map(w => w.id)})))}`);
    return winnersResult;
  }

  public reset() {
    this.pots = [];
    this.playerBets.clear();
    this.returnedBets.clear();
    console.log(`[reset] Pot manager cleared.`);
  }
}