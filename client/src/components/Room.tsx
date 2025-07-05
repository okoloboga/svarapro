type RoomProps = {
  id: number;
  players: number;
  stake: number;
};

export function Room({ id, players, stake }: RoomProps) {
  return (
    <div className="bg-secondary shadow-lg rounded-lg p-4 flex justify-between items-center">
      <div>
        <p className="text-white">Room #{id}</p>
        <p className="text-white text-sm">Players: {players}/6</p>
        <p className="text-white text-sm">Stake: {stake} USDT</p>
      </div>
      <div className="flex space-x-2">
        <button className="bg-button-fill text-white px-4 py-2 rounded-lg">Войти</button>
        <button className="bg-button-withdraw text-white px-4 py-2 rounded-lg">Смотреть</button>
      </div>
    </div>
  );
}
