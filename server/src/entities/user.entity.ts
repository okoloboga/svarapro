import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ 
    type: 'varchar',
    length: 64,
    unique: true 
  })
  @Index()
  telegramId: string;

  @Column({
    type: 'varchar',
    length: 32,
    nullable: true
  })
  username: string | null;

  @Column({
    type: 'varchar',
    length: 512,
    nullable: true
  })
  avatar: string | null;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    }
  })
  balance: number;
}
