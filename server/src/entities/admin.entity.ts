import { boolean } from 'joi';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('admins')
export class Admin {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ unique: true })
    telegramId: string;

    @Column()
    passwordHash: string;

    @Column({ default: false })
    isActive: boolean;

    @Column({ nullable: true })
    lastLoginAt: Date;
    
    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}