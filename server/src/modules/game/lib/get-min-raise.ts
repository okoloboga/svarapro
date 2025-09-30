import { GameState } from '../../../types/game';

export const getMinRaise = (gameState: GameState): number => {
  return gameState.minBet;
};
