import { Player } from '../../../types/game';

export interface Pot {
  limit: number;
  amount: number;
  contributors: string[];
}

export class PotManager {
  static calculatePots(players: Player[], totalPot: number): { pots: Pot[], returnedAmount: number, returnedTo: string | null } {
    const pots: Pot[] = [];
    let returnedAmount = 0;
    let returnedTo: string | null = null;

    const activePlayers = players.filter(p => !p.hasFolded && p.totalBet > 0);
    if (activePlayers.length === 0) {
      return { pots, returnedAmount, returnedTo };
    }

    const sortedBets = [...new Set(activePlayers.map(p => p.totalBet))].sort((a, b) => a - b);

    let lastBet = 0;
    for (const bet of sortedBets) {
      const contributors = activePlayers.filter(p => p.totalBet >= bet);
      if (contributors.length > 1) {
        const potAmount = contributors.length * (bet - lastBet);
        pots.push({
          limit: bet,
          amount: potAmount,
          contributors: contributors.map(p => p.id),
        });
        lastBet = bet;
      }
    }

    const calculatedPot = pots.reduce((sum, p) => sum + p.amount, 0);
    if (totalPot > calculatedPot) {
        const unassignedAmount = totalPot - calculatedPot;
        const lastRaiser = activePlayers.sort((a,b) => b.totalBet - a.totalBet)[0];
        if(lastRaiser) {
            returnedAmount = unassignedAmount;
            returnedTo = lastRaiser.id;
        }
    }

    return { pots, returnedAmount, returnedTo };
  }
}
