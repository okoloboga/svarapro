import { GameState } from '../../../types/game';
import { getAmountToCall } from './get-amount-to-call';

export const getMaxRaise = (gameState: GameState, playerId: string): number => {
  const player = gameState.players.find((p) => p.id === playerId);
  if (!player) {
    return 0;
  }

  // This now returns the raw amount needed to call, thanks to our previous change.
  const amountToCall = getAmountToCall(gameState, playerId);

  // If a player can't even cover the call, they certainly can't raise.
  if (player.balance <= amountToCall) {
    return 0;
  }

  // The max raise is the remainder of their balance after calling.
  // The game logic will handle refunds for uncalled raises.
  const availableBalanceForRaise = player.balance - amountToCall;

  return availableBalanceForRaise;
};
