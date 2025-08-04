export interface Room {
  roomId: string;
  minBet: number;
  type: 'public' | 'private';
  players: string[];
  status: 'waiting' | 'playing' | 'finished';
  maxPlayers: number;
  createdAt: string;
}
