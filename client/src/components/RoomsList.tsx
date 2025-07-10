import { useState, useEffect } from 'react';
import { Room } from './Room';

const rooms = [
  { id: 1, players: 2, stake: 10 },
  { id: 2, players: 4, stake: 100 },
  { id: 3, players: 6, stake: 500 },
  { id: 4, players: 1, stake: 20 },
  { id: 5, players: 3, stake: 150 },
  { id: 6, players: 5, stake: 300 },
  { id: 7, players: 2, stake: 50 },
  { id: 8, players: 4, stake: 200 },
  { id: 9, players: 6, stake: 600 },
  { id: 10, players: 3, stake: 80 },
  { id: 11, players: 1, stake: 30 },
  { id: 12, players: 5, stake: 400 },
  { id: 13, players: 2, stake: 90 },
  { id: 14, players: 4, stake: 250 },
  { id: 15, players: 6, stake: 700 },
];

const ITEMS_PER_PAGE = 10;

type RoomsListProps = {
  searchId: string;
  isAvailableFilter: boolean;
  stakeRange: [number, number]; // Новый пропс для диапазона ставок
};

export function RoomsList({ searchId, isAvailableFilter, stakeRange }: RoomsListProps) {
  const [currentPage, setCurrentPage] = useState(1);

  // Фильтрация комнат
  const filteredRooms = rooms.filter((room) => {
    const matchesSearch = searchId === '' || room.id.toString() === searchId;
    const matchesAvailability = !isAvailableFilter || room.players < 6;
    const matchesStake = room.stake >= stakeRange[0] && room.stake <= stakeRange[1]; // Включительно
    return matchesSearch && matchesAvailability && matchesStake;
  });

  const totalPages = Math.ceil(filteredRooms.length / ITEMS_PER_PAGE);
  useEffect(() => {
    setCurrentPage(1); // Сбрасываем страницу при изменении фильтров
  }, [searchId, isAvailableFilter, stakeRange]);

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedRooms = filteredRooms.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div className="space-y-4 mx-auto w-[336px]">
      <p className="text-white text-center mb-2" style={{ fontWeight: 600 }}>Присоединяйтесь к игре прямо сейчас</p>
      {paginatedRooms.length > 0 ? (
        paginatedRooms.map((room) => (
          <Room key={room.id} {...room} />
        ))
      ) : (
        <p className="text-white text-center">Комнаты не найдены</p>
      )}
      {totalPages > 1 && (
        <div className="flex justify-center space-x-2 mt-4" style={{ position: 'relative' }}>
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
            <button
              key={page}
              className="flex items-center justify-center relative"
              style={{
                boxSizing: 'border-box',
                width: '32px',
                height: '25px',
                background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, #2D2B31 100%)',
                boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)',
                borderRadius: '8px',
                overflow: 'hidden',
              }}
              onClick={() => setCurrentPage(page)}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: '1px',
                  background: page === currentPage ? '#2E2B33' : '#48454D',
                  borderRadius: '8px',
                  pointerEvents: 'none',
                  zIndex: 0,
                }}
              />
              <span
                className="relative z-10"
                style={{ color: '#C9C6CE', fontSize: '14px' }}
              >
                {page}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
