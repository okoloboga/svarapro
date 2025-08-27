import axios from 'axios';
import { AdminSession, AdminLoginState } from '../types';

export class AdminService {
    private session = new Map<string, AdminSession>();
    private loginState = new Map<string, AdminLoginState>();

    private readonly API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
    private readonly API_SECRET = process.env.API_SECRET;

    async verifyAdmin(telegramId: string, password: string): Promise<boolean> {
        try {
            const response = await axios.post(`${this.API_BASE_URL}/admins/verify`, {
                telegramId,
                password
            }, {
                headers: { 'Authorization': `Bearer ${this.API_SECRET}` }   
            });

            return response.data.isValid;
        } catch (error) {
            console.error('Admin verification failed:', error);
            return false;
        }
    }
    async createAdmin(telegramId: string, password: string): Promise<boolean> {
        try {
            const response = await axios.post(`${this.API_BASE_URL}/admins/create`, {
                telegramId,
                password
            }, {
                headers: { 'Authorization': `Bearer ${this.API_SECRET}` }
            });

            return response.status === 201;
        } catch (error) {
            console.error('Admin creation error:', error);
            return false;
        }
    }
    async isAdmin(telegramId: string): Promise<boolean> {
        try {
            const response = await axios.get(`${this.API_BASE_URL}/admins/check/${telegramId}`, {
                headers: { 'Authorization': `Bearer ${this.API_SECRET}` }
            });
            return response.data.isAdmin;
        } catch (error) {
            return false
        }
    }
    getSession(telegramId: string): AdminSession | undefined {
        return this.session.get(telegramId);
    }
    setSession(telegramId: string, session: AdminSession): void {
        this.session.set(telegramId, session);
    }
    getLoginState(telegramId: string): AdminLoginState | undefined {
        return this.loginState.get(telegramId);
    }
    setLoginState(telegramId: string, state: AdminLoginState): void {
        this.loginState.set(telegramId, state);
    }
    clearLoginState(telegramId: string): void {
        this.loginState.delete(telegramId);
    }
}