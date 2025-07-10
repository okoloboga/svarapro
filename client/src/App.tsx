import { useEffect, useState, useMemo } from 'react';
import { useSignal, isMiniAppDark, retrieveLaunchParams } from '@telegram-apps/sdk-react';
import { AppRoot } from '@telegram-apps/telegram-ui';
import { Dashboard } from './pages/Dashboard';
import { initTelegramSdk } from './utils/init';
import { apiService } from './services/api';
import { ErrorAlert } from './components/ErrorAlert';
import { LoadingPage } from './pages/LoadingPage';
import { More } from './pages/More';

// Определяем интерфейс для параметров запуска
interface LaunchParams {
  initData?: string;
  tgWebAppData?: Record<string, string | Record<string, any>>;
}

type ApiError = {
  message?: string;
  response?: {
    data?: any;
    status?: number;
  };
} | string;

type UserData = {
  id?: number | string;
  username?: string;
  photo_url?: string;
};

function App() {
  console.log('Launch App');
  const isDark = useSignal(isMiniAppDark);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'more'>('dashboard');
  const userData = useMemo(() => {
    const params = retrieveLaunchParams() as LaunchParams;
    return (params.tgWebAppData as { user?: UserData })?.user || {};
  }, []);

  useEffect(() => {
    console.log('Before initTelegramSdk');
    initTelegramSdk();
    console.log('Before launch params');
    const launchParams = retrieveLaunchParams() as LaunchParams;
    console.log('Launch params:', launchParams);

    // Извлекаем initData как строку напрямую
    let initData: string | undefined = launchParams.initData;
    if (!initData && launchParams.tgWebAppData) {
      // Если initData отсутствует, преобразуем tgWebAppData в строку
      initData = new URLSearchParams(
        Object.entries(launchParams.tgWebAppData)
          .filter(([key]) => key !== 'hash' && key !== 'signature') // Исключаем hash и signature
          .map(([key, value]) => [key, (value as string | Record<string, any>).toString()]) // Приведение типа
      ).toString();
    }

    const loadData = async () => {
      if (initData) {
        console.log('Sending login request with initData:', initData);
        try {
          const response = await apiService.login(initData); // Передаём строку
          console.log('Login response:', response);
        } catch (error) {
          const apiError = error as ApiError;
          const errorMessage = typeof apiError === 'string' ? apiError : apiError.message || 'Unknown error';
          console.error('Login error:', errorMessage, typeof apiError === 'object' && apiError.response ? apiError.response.data : 'No response data');
          setError(errorMessage);
        }
      } else {
        console.error('No initData available after check');
        setError('App not running in Telegram context or data unavailable');
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
      setIsLoading(false);
    };

    loadData();
  }, []);

  console.log('Rendering with isLoading:', isLoading, 'error:', error, 'currentPage:', currentPage);

  return (
    <AppRoot appearance={isDark ? 'dark' : 'light'} platform={'base'}>
      {isLoading ? (
        <LoadingPage isLoading={isLoading} />
      ) : error ? (
        <ErrorAlert code={undefined} customMessage={error} />
      ) : currentPage === 'more' ? (
        <More onBack={() => setCurrentPage('dashboard')} userData={userData} />
      ) : (
        <Dashboard onMoreClick={() => setCurrentPage('more')} />
      )}
    </AppRoot>
  );
}

export default App;
