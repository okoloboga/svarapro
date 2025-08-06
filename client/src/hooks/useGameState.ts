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
    
    // Присоединяемся к игре
    socket.emit('join_game', { roomId });
    
    // Слушаем обновления состояния игры
    socket.on('game_state', (state: GameState) => {
      setGameState(state);
      setLoading(false);
      
      // Проверяем, сидит ли пользователь за столом
      const userId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() || '';
      setIsSeated(state.players.some(p => p.id === userId));
    });
    
    socket.on('game_update', (state: GameState) => {
      setGameState(state);
      
      // Проверяем, сидит ли пользователь за столом
      const userId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() || '';
      setIsSeated(state.players.some(p => p.id === userId));
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
  
  // Функция для того, чтобы сесть за стол
  const sitDown = useCallback((position: number) => {
    const socket = initSocket();
    socket.emit('game_action', { roomId, action: 'sit_down', position });
  }, [roomId]);
  
  // Функция для приглашения в игру
  const invitePlayer = useCallback(() => {
    const socket = initSocket();
    socket.emit('game_action', { roomId, action: 'invite' });
  
    // Получаем ссылку на комнату
    const roomLink = `https://t.me/your_bot_name?start=join_${roomId}`;
  
    // Открываем диалог для отправки приглашения
    if (window.Telegram?.WebApp) {
      window.open(roomLink, '_blank');
    } else {
      // Копируем ссылку в буфер обмена, если Telegram API недоступен
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
