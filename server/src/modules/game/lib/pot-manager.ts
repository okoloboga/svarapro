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
    const activePlayers = players.filter((p) => !p.hasFolded && p.totalBet > 0);
    if (activePlayers.length === 0) return;

    activePlayers.forEach((p) => {
      this.playerBets.set(p.id, p.totalBet);
    });

    this.calculatePots();
  }

  private calculatePots() {
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

        // Adjust the last pot amount
        const lastPot = this.pots[this.pots.length - 1];
        if (lastPot) {
          lastPot.amount -= amountToReturn;
        }
      }
    }
  }

  public getPots(): Pot[] {
    return this.pots;
  }

  public getReturnedBets(): Map<string, number> {
    return this.returnedBets;
  }

  public getWinners(
    players: Player[],
  ): { potIndex: number; winners: Player[]; amount: number }[] {
    const winnersResult: {
      potIndex: number;
      winners: Player[];
      amount: number;
    }[] = [];

    for (let i = 0; i < this.pots.length; i++) {
      const pot = this.pots[i];
      let bestHandValue = -1;
      let potWinners: Player[] = [];

      const eligiblePlayers = players.filter((p) =>
        pot.eligiblePlayers.has(p.id),
      );

      for (const player of eligiblePlayers) {
        const handValue = player.score || 0; // Assuming score is pre-calculated
        if (handValue > bestHandValue) {
          bestHandValue = handValue;
          potWinners = [player];
        } else if (handValue === bestHandValue) {
          potWinners.push(player);
        }
      }
      winnersResult.push({
        potIndex: i,
        winners: potWinners,
        amount: pot.amount,
      });
    }
    return winnersResult;
  }

  public reset() {
    this.pots = [];
    this.playerBets.clear();
    this.returnedBets.clear();
  }
}
