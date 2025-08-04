import { io, Socket } from 'socket.io-client';

export const initSocket = (): Socket => {
  const socket = io(import.meta.env.VITE_API_URL || 'https://svarapro.com/api/v1', {
    withCredentials: true,
    transports: ['websocket'],
  });

  socket.on('connect', () => {
    console.log('WebSocket connected');
    socket.emit('request_rooms'); // Запрашиваем начальный список комнат
  });

  socket.on('disconnect', () => {
    console.log('WebSocket disconnected');
  });

  return socket;
};
