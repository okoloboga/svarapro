import React from 'react';
import { useTranslation } from 'react-i18next';
import { Socket } from 'socket.io-client';

type GameRoomProps = {
  roomId: string;
  socket: Socket | null;
  balance: string;
};

export function GameRoom({ roomId, socket, balance }: GameRoomProps) {
  const { t } = useTranslation('common');

  return (
    <div className="bg-primary min-h-screen flex flex-col items-center justify-center">
      <h2 className="text-white font-semibold text-lg mb-4">
        {t('game_room')} №{roomId.slice(0, 8)}
      </h2>
      <p className="text-white">Balance: ${balance}</p>
      <p className="text-white">Game logic coming soon...</p>
    </div>
  );
}
