import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, Index } from 'typeorm';
import { User } from './user.entity';

@Entity('deposits')
export class Deposit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.id)
  @Index()
  user: User; // Пользователь, сделавший депозит

  @Column({
    type: 'varchar',
    length: 16,
  })
  currency: string; // Валюта депозита (USDT-TON, TON)

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    }
  })
  amount: number; // Сумма депозита

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @Column({
    type: 'enum',
    enum: ['pending', 'failed', 'complete'],
    default: 'pending',
  })
  status: string;

  @Column({
    type: 'varchar',
    length: 128,
  })
  address: string; // Сгенерированный адрес для оплаты

  @Column({
    type: 'varchar',
    length: 64,
  })
  tracker_id: string; // ID для связи с exnode

  @Column({
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  transaction_hash: string | undefined; // Детали транзакции в блокчейне
}
