import { io, Socket } from 'socket.io-client';
import { UserData } from '@/types/entities';

export const initSocket = (telegramId?: string, userData?: UserData): Socket => {
  const defaultTelegramId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() || '';
  const defaultUserData = {
    username: window.Telegram?.WebApp?.initDataUnsafe?.user?.username || 'Unknown',
    avatar: window.Telegram?.WebApp?.initDataUnsafe?.user?.photo_url || '',
  };

  console.log('Initializing WebSocket with telegramId:', telegramId || defaultTelegramId, 'userData:', userData || defaultUserData);

  const socket = io('https://svarapro.com', {
    withCredentials: true,
    transports: ['websocket'],
    auth: {
      telegramId: telegramId || defaultTelegramId,
      userData: userData || defaultUserData,
    },
  });

  socket.on('connect', () => {
    console.log('WebSocket connected, telegramId:', telegramId || defaultTelegramId);
    socket.emit('request_rooms');
  });

  socket.on('connect_error', (error) => {
    console.error('WebSocket connection error:', error.message);
  });

  socket.on('disconnect', () => {
    console.log('WebSocket disconnected');
  });

  socket.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  return socket;
};
