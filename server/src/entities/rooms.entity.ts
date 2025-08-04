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
  status: 'waiting' | 'playing' | 'finished';

  @Column()
  createdAt: Date;

  @Column({ nullable: true })
  finishedAt?: Date;
}
