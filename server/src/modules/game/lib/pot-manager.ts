import { Player } from '../../../types/game';

export interface Pot {
  amount: number;
  contributors: string[];
}

export class PotManager {
  static calculatePots(players: Player[]): { pots: Pot[], returnedAmount: number, returnedTo: string | null } {
    const pots: Pot[] = [];
    let returnedAmount = 0;
    let returnedTo: string | null = null;

    const activePlayers = players.filter(p => !p.hasFolded && p.totalBet > 0);
    if (activePlayers.length === 0) {
      return { pots, returnedAmount, returnedTo };
    }

    const sortedPlayers = [...activePlayers].sort((a, b) => a.totalBet - b.totalBet);

    while (sortedPlayers.some(p => p.totalBet > 0)) {
      const lowestBet = sortedPlayers[0].totalBet;
      const contributors = activePlayers.filter(p => p.totalBet >= lowestBet);
      const potAmount = contributors.length * lowestBet;

      pots.push({
        amount: potAmount,
        contributors: contributors.map(p => p.id),
      });

      activePlayers.forEach(p => {
        p.totalBet -= lowestBet;
      });

      const playerWithRemainingBet = sortedPlayers.find(p => p.totalBet > 0);
      if (contributors.length === 1 && playerWithRemainingBet) {
        returnedAmount = playerWithRemainingBet.totalBet;
        returnedTo = playerWithRemainingBet.id;
        playerWithRemainingBet.totalBet = 0;
      }
      
      sortedPlayers.sort((a, b) => a.totalBet - b.totalBet);
      while(sortedPlayers.length > 0 && sortedPlayers[0].totalBet === 0) {
        sortedPlayers.shift();
      }
    }

    return { pots, returnedAmount, returnedTo };
  }
}