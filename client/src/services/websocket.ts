import { io, Socket } from 'socket.io-client';

export const initSocket = (): Socket => {
  const telegramId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() || '';
  const userData = {
    username: window.Telegram?.WebApp?.initDataUnsafe?.user?.username || 'Unknown',
    avatar: window.Telegram?.WebApp?.initDataUnsafe?.user?.photo_url || '',
  };

  const socket = io(import.meta.env.VITE_API_URL || 'https://svarapro.com/api/v1', {
    withCredentials: true,
    transports: ['websocket'],
    auth: {
      telegramId,
      userData,
    },
  });

  socket.on('connect', () => {
    console.log('WebSocket connected, telegramId:', telegramId);
    socket.emit('request_rooms');
  });

  socket.on('disconnect', () => {
    console.log('WebSocket disconnected');
  });

  socket.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  return socket;
};
