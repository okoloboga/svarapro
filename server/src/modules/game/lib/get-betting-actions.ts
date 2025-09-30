import { GameState } from '../../../types/game';
import { getAmountToCall } from './get-amount-to-call';
import { getMinRaise } from './get-min-raise';
import { getMaxRaise } from './get-max-raise';

export const getBettingActions = (
  gameState: GameState,
  playerId: string,
): any[] => {
  const player = gameState.players.find((p) => p.id === playerId);
  if (!player || !player.isActive || player.isAllIn) {
    return [];
  }

  const actions: any[] = [];
  const amountToCall = getAmountToCall(gameState, playerId);

  actions.push({ type: 'fold' });

  if (amountToCall > 0) {
    if (player.balance > amountToCall) {
      actions.push({ type: 'call', amount: amountToCall });
    } else if (player.balance > 0) {
      actions.push({ type: 'call', amount: player.balance, isAllIn: true });
    }
  } else {
    actions.push({ type: 'check' });
  }

  const minRaise = getMinRaise(gameState);
  const maxRaise = getMaxRaise(gameState, playerId);

  if (maxRaise > 0) {
    actions.push({
      type: 'raise',
      min: Math.min(minRaise, maxRaise),
      max: maxRaise,
      step: gameState.minBet,
    });
  }

  return actions;
};