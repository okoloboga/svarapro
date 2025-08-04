import { useState, useEffect } from 'react';
import { Room as RoomComponent } from './Room';
import { Button } from '../Button/Button';
import { useTranslation } from 'react-i18next';
import { apiService } from '../../services/api/api';
import { Room } from '../../types/game';
import { Socket } from 'socket.io-client';

const ITEMS_PER_PAGE = 10;

type RoomsListProps = {
  searchId: string;
  isAvailableFilter: boolean;
  stakeRange: [number, number];
  socket: Socket | null;
  setCurrentPage: (page: string, data?: any) => void; // Добавляем prop
};

export function RoomsList({ searchId, isAvailableFilter, stakeRange, socket, setCurrentPage }: RoomsListProps) {
  const { t } = useTranslation('common');
  const [currentPage, setCurrentPage] = useState(1);
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const fetchedRooms = await apiService.getRooms();
        setRooms(fetchedRooms);
      } catch (error) {
        console.error('Failed to fetch rooms:', error);
      }
    };

    fetchRooms();

    if (socket) {
      socket.on('rooms', (data: { action: string; room: Room }) => {
        if (data.action === 'update') {
          setRooms((prevRooms) => {
            const updatedRooms = prevRooms.filter((r) => r.roomId !== data.room.roomId);
            return [...updatedRooms, data.room].sort((a, b) => a.roomId.localeCompare(b.roomId));
          });
        }
      });

      return () => {
        socket.off('rooms');
      };
    }
  }, [socket]);

  useEffect(() => {
    setCurrentPage(1); // Сбрасываем страницу при изменении фильтров
  }, [searchId, isAvailableFilter, stakeRange]);

  const filteredRooms = rooms.filter((room) => {
    const matchesSearch = searchId === '' || room.roomId === searchId;
    const matchesAvailability = !isAvailableFilter || room.players.length < room.maxPlayers;
    const matchesStake = room.minBet >= stakeRange[0] && room.minBet <= stakeRange[1];
    return matchesSearch && matchesAvailability && matchesStake && room.type === 'public'; // Только публичные
  });

  const totalPages = Math.ceil(filteredRooms.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedRooms = filteredRooms.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div className="space-y-4 mx-auto w-[93vw]">
      <p className="text-white text-center mb-2" style={{ fontWeight: 600 }}>{t('join_game_now')}</p>
      {paginatedRooms.length > 0 ? (
        paginatedRooms.map((room) => (
          <RoomComponent
            key={room.roomId}
            roomId={room.roomId}
            players={room.players.length}
            stake={room.minBet}
            setCurrentPage={setCurrentPage}
          />
        ))
      ) : (
        <p className="text-white text-center">{t('rooms_not_found')}</p>
      )}
      {totalPages > 1 && (
        <div className="flex justify-center space-x-2 mt-4">
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
            <Button
              key={page}
              variant="secondary"
              className="w-[32px] h-[25px] text-sm text-gray-400"
              isActive={page === currentPage}
              onClick={() => setCurrentPage(page)}
            >
              {page}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
