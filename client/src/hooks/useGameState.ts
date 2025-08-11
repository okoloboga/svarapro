import { useState, useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { GameState } from '@/types/game';

export const useGameState = (roomId: string, socket: Socket | null) => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSeated, setIsSeated] = useState(false);

  useEffect(() => {
    if (!socket) {
      console.error('No socket provided for useGameState');
      setError('WebSocket не инициализирован');
      setLoading(false);
      return;
    }

    console.log('Joining game with roomId:', roomId);
    
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
  }, [roomId, socket]);

  const performAction = useCallback((action: string, amount?: number) => {
    if (socket) {
      console.log('Emitting game_action:', { roomId, action, amount });
      socket.emit('game_action', { roomId, action, amount });
    } else {
      console.error('Cannot perform action: socket not initialized');
    }
  }, [roomId, socket]);

  const sitDown = useCallback((position: number, userData: any) => {
    if (socket) {
      const payload = { roomId, position, userData };
      console.log('Emitting sit_down with payload:', payload);
      socket.emit('sit_down', payload);
    } else {
      console.error('Cannot sit down: socket not initialized');
    }
  }, [roomId, socket]);

  const invitePlayer = useCallback(() => {
    if (socket) {
      console.log('Emitting game_action for invite:', { roomId });
      socket.emit('game_action', { roomId, action: 'invite' });
    } else {
      console.error('Cannot invite player: socket not initialized');
    }

    const roomLink = `https://t.me/your_bot_name?start=join_${roomId}`;
  
    if (window.Telegram?.WebApp) {
      window.open(roomLink, '_blank');
    } else {
      navigator.clipboard.writeText(roomLink);
      alert('Ссылка на игру скопирована в буфер обмена');
    }
  }, [roomId, socket]);

  const leaveRoom = useCallback(() => {
    if (socket) {
      console.log('Emitting leave_room:', { roomId });
      socket.emit('leave_room', { roomId });
    } else {
      console.error('Cannot leave room: socket not initialized');
    }
  }, [roomId, socket]);

  const actions = {
    blindBet: useCallback((amount: number) => performAction('blind_bet', amount), [performAction]),
    lookCards: useCallback(() => performAction('look'), [performAction]),
    call: useCallback(() => performAction('call'), [performAction]),
    raise: useCallback((amount: number) => performAction('raise', amount), [performAction]),
    fold: useCallback(() => performAction('fold'), [performAction]),
    sitDown,
    invitePlayer,
    leaveRoom,
  };

  return {
    gameState,
    loading,
    error,
    isSeated,
    actions,
  };
};
