import { useEffect, useState } from 'react';
import { useSignal, isMiniAppDark, retrieveLaunchParams } from '@telegram-apps/sdk-react';
import { AppRoot } from '@telegram-apps/telegram-ui';
import { Dashboard } from './pages/Dashboard';
import { initTelegramSdk } from './utils/init';
import { apiService } from './services/api';
import { ErrorAlert } from './components/ErrorAlert';
import { LoadingPage } from './pages/LoadingPage';

// Определение типа ошибки
type ApiError = {
  message?: string;
  response?: {
    data?: any;
    status?: number;
  };
} | string;

function App() {
  console.log('Launch App');
  const isDark = useSignal(isMiniAppDark);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log('Before initTelegramSdk');
    initTelegramSdk();
    console.log('Before launch params');
    const launchParams = retrieveLaunchParams();
    console.log('Launch params:', launchParams);
    let initData = launchParams.tgWebAppData;

    if (!initData) {
      console.warn('No initData found, relying on mock');
      // Здесь можно вызвать mockTelegram, но оно уже должно быть вызвано в main.tsx
      initData = launchParams.tgWebAppData; // После мока должно быть заполнено
    }

    const loadData = async () => {
      if (initData) {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(initData)) {
          if (value !== undefined) {
            params.append(key, typeof value === 'object' ? JSON.stringify(value) : value.toString());
          }
        }
        console.log('Sending login request with params:', params.toString());
        console.log('VITE_API_URL:', import.meta.env.VITE_API_URL);
        try {
          const response = await apiService.login(params.toString());
          console.log('Login response:', response);
        } catch (error) {
          const apiError = error as ApiError;
          const errorMessage = typeof apiError === 'string' ? apiError : apiError.message || 'Unknown error';
          console.error('Login error:', errorMessage, typeof apiError === 'object' && apiError.response ? apiError.response.data : 'No response data');
          setError(errorMessage);
        }
      } else {
        console.error('No initData available after mock check');
        setError('App not running in Telegram context or mock failed');
      }
      // Принудительная задержка 2 секунды перед завершением загрузки
      await new Promise(resolve => setTimeout(resolve, 2000));
      setIsLoading(false); // Завершение загрузки
    };

    loadData();
  }, []);

  console.log('Rendering with isLoading:', isLoading, 'error:', error);

  return (
    <AppRoot appearance={isDark ? 'dark' : 'light'} platform={'base'}>
      {isLoading ? (
        <LoadingPage isLoading={isLoading} />
      ) : error ? (
        <ErrorAlert code={undefined} customMessage={error} />
      ) : (
        <Dashboard />
      )}
    </AppRoot>
  );
}

export default App;
