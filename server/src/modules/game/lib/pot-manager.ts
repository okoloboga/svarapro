import { Player } from '../../../types/game';

export interface Pot {
  limit: number;
  amount: number;
  contributors: string[];
}

export class PotManager {
  static calculatePots(players: Player[], pot: number): { pots: Pot[], returnedAmount: number, returnedTo: string | null } {
    const pots: Pot[] = [];
    let returnedAmount = 0;
    let returnedTo: string | null = null;

    const activePlayers = players.filter(p => !p.hasFolded && p.totalBet > 0);
    console.log(`[calculatePots] Active players: ${activePlayers.map(p => p.username).join(', ')}`);
    if (activePlayers.length === 0) {
      return { pots, returnedAmount, returnedTo };
    }

    const sortedBets = [...new Set(activePlayers.map(p => p.totalBet))].sort((a, b) => a - b);
    console.log(`[calculatePots] Sorted bets: ${sortedBets}`);

    let lastBet = 0;
    for (const bet of sortedBets) {
      const contributors = activePlayers.filter(p => p.totalBet >= bet);
      const potAmount = contributors.length * (bet - lastBet);
      pots.push({
        limit: bet,
        amount: potAmount,
        contributors: contributors.map(p => p.id),
      });
      lastBet = bet;
    }

    console.log(`[calculatePots] Created pots: ${JSON.stringify(pots, null, 2)}`);

    const totalPot = pots.reduce((sum, p) => sum + p.amount, 0);
    if (pot > totalPot) {
        const lastRaiser = players.find(p => p.totalBet > (sortedBets[sortedBets.length - 2] || 0));
        if(lastRaiser) {
            returnedAmount = pot - totalPot;
            returnedTo = lastRaiser.id;
        }
    }

    return { pots, returnedAmount, returnedTo };
  }
}