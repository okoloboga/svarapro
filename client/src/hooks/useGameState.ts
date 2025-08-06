import { useState, useEffect, useCallback } from 'react';
import { initSocket } from '@/services/websocket';
import { GameState } from '@/types/game';

export const useGameState = (roomId: string) => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const socket = initSocket();
    
    // Присоединяемся к игре
    socket.emit('join_game', { roomId });
    
    // Слушаем обновления состояния игры
    socket.on('game_state', (state: GameState) => {
      setGameState(state);
      setLoading(false);
    });
    
    socket.on('game_update', (state: GameState) => {
      setGameState(state);
    });
    
    socket.on('error', (data: { message: string }) => {
      setError(data.message);
    });
    
    return () => {
      socket.off('game_state');
      socket.off('game_update');
      socket.off('error');
    };
  }, [roomId]);
  
  // Функции для действий в игре
  const performAction = useCallback((action: string, amount?: number) => {
    const socket = initSocket();
    socket.emit('game_action', { roomId, action, amount });
  }, [roomId]);
  
  const actions = {
    blindBet: useCallback((amount: number) => performAction('blind_bet', amount), [performAction]),
    lookCards: useCallback(() => performAction('look'), [performAction]),
    call: useCallback(() => performAction('call'), [performAction]),
    raise: useCallback((amount: number) => performAction('raise', amount), [performAction]),
    fold: useCallback(() => performAction('fold'), [performAction]),
  };
  
  return {
    gameState,
    loading,
    error,
    actions,
  };
};
