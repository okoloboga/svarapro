import { GameState } from '../../../types/game';
import { getAmountToCall } from './get-amount-to-call';
import { getMinRaise } from './get-min-raise';
import { getMaxRaise } from './get-max-raise';

export const getBlindBettingActions = (
  gameState: GameState,
  playerId: string,
): any[] => {
  const player = gameState.players.find((p) => p.id === playerId);
  if (!player || !player.isActive || player.isAllIn) {
    return [];
  }

  const actions: any[] = [];

  if (player.hasLooked) {
    // Player has seen their cards, normal betting actions apply
    actions.push({ type: 'fold' });

    const amountToCall = getAmountToCall(gameState, playerId);
    if (amountToCall > 0) {
      if (player.balance >= amountToCall) {
        actions.push({ type: 'call', amount: amountToCall });
      } else {
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
  } else {
    // Player has not seen their cards
    actions.push({ type: 'look' });

    // Can they make a blind bet?
    const lastBlindBet = gameState.currentBet || 0; // Changed from lastBet
    const nextBlindBet = lastBlindBet > 0 ? lastBlindBet * 2 : gameState.minBet;

    if (player.balance >= nextBlindBet) {
      actions.push({ type: 'blind', amount: nextBlindBet });
    }
  }

  return actions;
};
