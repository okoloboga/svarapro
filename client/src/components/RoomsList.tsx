import { Room } from './Room';

const rooms = [
  { id: 1, players: 2, stake: 10 },
  { id: 2, players: 4, stake: 100 },
  { id: 3, players: 6, stake: 500 },
];

export function RoomsList() {
  return (
    <div className="space-y-4">
      {rooms.map((room) => (
        <Room key={room.id} {...room} />
      ))}
    </div>
  );
}
