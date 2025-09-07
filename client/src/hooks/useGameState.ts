import { useState, useEffect, useCallback, useMemo } from 'react';
import { Socket } from 'socket.io-client';
import { GameState } from '@/types/game';
import { UserData } from '@/types/entities';
import { useSoundContext } from '@/context/SoundContext';
import { SoundType } from './useSound';

export const useGameState = (roomId: string, socket: Socket | null) => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSeated, setIsSeated] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { playSound } = useSoundContext();

  useEffect(() => {
    if (!socket) {
      console.error('No socket provided for useGameState');
      setError('WebSocket не инициализирован');
      setLoading(false);
      return;
    }

    // Очищаем ошибку при успешном подключении
    if (socket.connected) {
      setError(null);
    }

    socket.on('game_state', (state: GameState) => {
      setGameState(state);
      setLoading(false);
      setIsProcessing(false);
      
      const userId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() || '';
      setIsSeated(state.players.some(p => p.id === userId));
    });
    
    socket.on('game_update', (state: GameState) => {
      setGameState(state);
      setLoading(false);
      setIsProcessing(false);
      
      const userId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() || '';
      setIsSeated(state.players.some(p => p.id === userId));
    });

    socket.on('play_sound', (sound: SoundType) => {
      playSound(sound);
    });
    
    socket.on('error', (data: { message: string }) => {
      console.error('Socket error:', data.message);
      setError(data.message);
      setLoading(false);
      setIsProcessing(false);
    });

    // Обработчики подключения/отключения
    socket.on('connect', () => {
      console.log('WebSocket connected, clearing error');
      setError(null);
      setLoading(false);
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setError('Соединение потеряно. Попытка переподключения...');
    });

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setError('Ошибка подключения. Попытка переподключения...');
    });

    // Emit join_room after listeners are set up
    socket.emit('join_room', { roomId });
    
    return () => {
      socket.off('game_state');
      socket.off('game_update');
      socket.off('error');
      socket.off('play_sound');
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
    };
  }, [roomId, socket, playSound]);

  const performAction = useCallback((action: string, amount?: number) => {
    if (socket) {
      setIsProcessing(true);
      socket.emit('game_action', { roomId, action, amount });
    } else {
      console.error('Cannot perform action: socket not initialized');
    }
  }, [roomId, socket]);

  const sitDown = useCallback((position: number, userData: UserData) => {
    if (socket) {
      setIsProcessing(true);
      const payload = { roomId, position, userData };
      socket.emit('sit_down', payload);
    } else {
      console.error('Cannot sit down: socket not initialized');
    }
  }, [roomId, socket]);

  const invitePlayer = useCallback(() => {
    if (socket) {
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
      socket.emit('leave_room', { roomId });
    } else {
      console.error('Cannot leave room: socket not initialized');
    }
  }, [roomId, socket]);

  const actions = useMemo(() => ({
    blindBet: (amount: number) => performAction('blind_bet', amount),
    lookCards: () => performAction('look'),
    call: () => performAction('call'),
    raise: (amount: number) => performAction('raise', amount),
    allIn: (amount: number) => performAction('all_in', amount),
    fold: () => performAction('fold'),
    joinSvara: () => performAction('join_svara'),
    skipSvara: () => performAction('skip_svara'),
    sitDown,
    invitePlayer,
    leaveRoom,
    playSound,
  }), [performAction, sitDown, invitePlayer, leaveRoom, playSound]);

  return {
    gameState,
    loading,
    error,
    isSeated,
    isProcessing,
    actions,
  };
};
