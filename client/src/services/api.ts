import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://svarapro/api/v1',
  withCredentials: true,
});

export const apiService = {
  async login(initData: string | Record<string, any>): Promise<{ accessToken: string }> {
    // Преобразуем initData в строку, если это объект
    const initDataString = typeof initData === 'string' 
      ? initData 
      : new URLSearchParams(
          Object.entries(initData).map(([key, value]) => [key, typeof value === 'object' ? JSON.stringify(value) : value.toString()])
        ).toString();

    // Лог того, что отправляем на сервер
    console.log('Sending to server - initData:', initDataString);

    // Выполняем запрос
    try {
      const response = await api.post('/auth/login', { initData: initDataString });
      localStorage.setItem('token', response.data.accessToken);
      return response.data;
    } catch (error) {
      throw error; // Передаём ошибку для обработки в компоненте
    }
  },
  async getProfile(): Promise<{ id: number; telegramId: string; username: string; avatar: string; balance: string }> {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('No token available');
    const response = await api.get('/users/profile', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },
};
