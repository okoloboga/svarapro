import { io, Socket } from 'socket.io-client';
import { UserData } from '@/types/entities';

export const initSocket = (telegramId?: string, userData?: UserData): Socket => {
  const defaultTelegramId =
    window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() || '';
  const defaultUserData = {
    username:
      window.Telegram?.WebApp?.initDataUnsafe?.user?.username || 'Unknown',
    avatar: window.Telegram?.WebApp?.initDataUnsafe?.user?.photo_url || '',
  };



  const socket = io('https://svarapro.com', {
    withCredentials: true,
    transports: ['websocket'],
    auth: {
      telegramId: telegramId || defaultTelegramId,
      userData: userData || defaultUserData,
    },
    reconnection: true, // Явно включаем реконнект
    reconnectionAttempts: 10, // Увеличиваем количество попыток
    reconnectionDelay: 2000, // Задержка между попытками
  });

  socket.on('connect', () => {
    socket.emit('request_rooms');
  });

  socket.on('connect_error', (error) => {
    console.error('WebSocket connection error:', error.message);
  });

  socket.on('disconnect', () => {
  });

  socket.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  // --- Логика восстановления соединения при возвращении в приложение ---
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && !socket.connected) {
      socket.connect();
    }
  };

  // Убираем старый обработчик, если он был, и добавляем новый
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  return socket;
};
