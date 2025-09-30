import { GameState } from '../../../types/game';
import { getPlayerTotalBet } from './get-player-total-bet';

export const getAmountToCall = (
  gameState: GameState,
  playerId: string,
): number => {
  const player = gameState.players.find((p) => p.id === playerId);
  if (!player) {
    return 0;
  }

  const highestBet = Math.max(
    ...gameState.players.map((p) => getPlayerTotalBet(gameState, p.id)),
  );
  const playerBet = getPlayerTotalBet(gameState, playerId);

  const amountToCall = highestBet - playerBet;

  return amountToCall;
};
