export interface Room {
  roomId: string;
  minBet: number;
  type: 'public' | 'private';
  players: string[];
  status: 'waiting' | 'playing' | 'finished';
  maxPlayers: number;
  createdAt: Date;
  finishedAt?: Date;
  password?: string;
  winner?: string; // telegramId победителя
}
