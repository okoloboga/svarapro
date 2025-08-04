import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('rooms')
export class Room {
  @PrimaryColumn()
  roomId: string;

  @Column()
  minBet: number;

  @Column()
  type: 'public' | 'private';

  @Column('simple-array')
  players: string[];

  @Column()
  createdAt: Date;

  @Column({ nullable: true })
  finishedAt?: Date;

  @Column({ nullable: true })
  winner?: string; // telegramId победителя
}
