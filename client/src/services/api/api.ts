import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://svarapro.com/api/v1',
  withCredentials: true,
});

export const apiService = {
  async login(initData: string, startPayload?: string): Promise<{ accessToken: string }> {
    console.log('Sending to server - initData:', initData, 'startPayload:', startPayload);
    try {
      const response = await api.post('/auth/login', { initData, startPayload });
      localStorage.setItem('token', response.data.accessToken);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  async getProfile(): Promise<{ 
    id: number; 
    telegramId: string; 
    username: string; 
    avatar: string; 
    balance: string 
  }> {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('No token available');
    const response = await api.get('/users/profile', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },
  async getReferralLink(): Promise<any> { // Без строгой типизации, как просил
    const token = localStorage.getItem('token');
    if (!token) throw new Error('No token available');
    const response = await api.get('/users/referral-link', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },
};
