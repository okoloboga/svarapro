import { GameState } from '../../../types/game';

export const getPlayerTotalBet = (
  gameState: GameState,
  playerId: string,
): number => {
  const player = gameState.players.find((p) => p.id === playerId);
  if (!player) {
    return 0;
  }
  return player.totalBet || 0;
};
