import { useState, useEffect, useCallback } from 'react';
import { initSocket } from '@/services/websocket';
import { GameState } from '@/types/game';

export const useGameState = (roomId: string) => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSeated, setIsSeated] = useState(false);
  
  useEffect(() => {
    const socket = initSocket();
    
    console.log('Joining game with roomId:', roomId);
    socket.emit('join_game', { roomId });
    
    socket.on('game_state', (state: GameState) => {
      console.log('Received game_state:', state);
      setGameState(state);
      setLoading(false);
      
      const userId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() || '';
      setIsSeated(state.players.some(p => p.id === userId));
    });
    
    socket.on('game_update', (state: GameState) => {
      console.log('Received game_update:', state);
      setGameState(state);
      
      const userId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() || '';
      setIsSeated(state.players.some(p => p.id === userId));
    });
    
    socket.on('error', (data: { message: string }) => {
      console.error('Socket error:', data.message);
      setError(data.message);
      setLoading(false);
    });
    
    return () => {
      console.log('Cleaning up socket listeners for roomId:', roomId);
      socket.off('game_state');
      socket.off('game_update');
      socket.off('error');
    };
  }, [roomId]);
  
  const performAction = useCallback((action: string, amount?: number) => {
    const socket = initSocket();
    console.log('Emitting game_action:', { roomId, action, amount });
    socket.emit('game_action', { roomId, action, amount });
  }, [roomId]);
  
  const sitDown = useCallback((position: number) => {
    const socket = initSocket();
    console.log('Emitting sit_down:', { roomId, position });
    socket.emit('sit_down', { roomId, position });
  }, [roomId]);
  
  const invitePlayer = useCallback(() => {
    const socket = initSocket();
    console.log('Emitting game_action for invite:', { roomId });
    socket.emit('game_action', { roomId, action: 'invite' });
  
    const roomLink = `https://t.me/your_bot_name?start=join_${roomId}`;
  
    if (window.Telegram?.WebApp) {
      window.open(roomLink, '_blank');
    } else {
      navigator.clipboard.writeText(roomLink);
      alert('Ссылка на игру скопирована в буфер обмена');
    }
  }, [roomId]);
  
  const actions = {
    blindBet: useCallback((amount: number) => performAction('blind_bet', amount), [performAction]),
    lookCards: useCallback(() => performAction('look'), [performAction]),
    call: useCallback(() => performAction('call'), [performAction]),
    raise: useCallback((amount: number) => performAction('raise', amount), [performAction]),
    fold: useCallback(() => performAction('fold'), [performAction]),
    sitDown,
    invitePlayer,
  };
  
  return {
    gameState,
    loading,
    error,
    isSeated,
    actions,
  };
};
