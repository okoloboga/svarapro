import { Entity, PrimaryGeneratedColumn, ManyToOne, Index } from 'typeorm';
import { User } from './user.entity';

@Entity('referrals')
export class Referral {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.id, { onDelete: 'CASCADE' })
  @Index()
  referrer: User; // Пользователь, который пригласил

  @ManyToOne(() => User, (user) => user.id, { onDelete: 'CASCADE' })
  @Index()
  referral: User; // Пользователь, которого пригласили
}
