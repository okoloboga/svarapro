import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://svarapro.com/api/v1',
  withCredentials: true,
});

export const apiService = {
  async login(initData: string, startPayload?: string): Promise<{ accessToken: string }> {
    console.log('Sending to server - initData:', initData, 'startPayload:', startPayload);
    const response = await api.post('/auth/login', { initData, startPayload });
    localStorage.setItem('token', response.data.accessToken);
    return response.data;
  },

  async getProfile(): Promise<{
    id: number;
    telegramId: string;
    username: string;
    avatar: string;
    balance: string;
    walletAddress: string | null;
  }> {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('No token available');
    const response = await api.get('/users/profile', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },

  async getReferralLink(): Promise<unknown> {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('No token available');
    const response = await api.get('/users/referral-link', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },

  async initiateDeposit(currency: string): Promise<{ address: string; trackerId: string }> {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('No token available');

    const profile = await this.getProfile();
    const telegramId = profile.telegramId;

    const response = await api.post(
      '/finances/transaction',
      { telegramId, currency, type: 'deposit' },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  },

  async initiateWithdraw(currency: string, amount: number): Promise<{ address: string; trackerId: string }> {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('No token available');

    const profile = await this.getProfile();
    const telegramId = profile.telegramId;

    const response = await api.post(
      '/finances/transaction',
      { telegramId, currency, type: 'withdraw', amount },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  },

  async getTransactionHistory(userId: string): Promise<
    {
      type: 'deposit' | 'withdraw';
      currency: string;
      amount: number;
      status: 'pending' | 'canceled' | 'confirmed';
      tracker_id: string;
      createdAt: string;
    }[]
  > {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('No token available');
    const response = await api.get(`/finances/history/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },

  async addWalletAddress(walletAddress: string): Promise<void> {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('No token available');

    await api.post('/users/wallet-address', { walletAddress }, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },
};
