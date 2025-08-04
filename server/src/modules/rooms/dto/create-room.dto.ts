export class CreateRoomDto {
  minBet: number;
  type: 'public' | 'private';
  password?: string; // Пароль для приватных комнат, используется как roomId
}
