import { useEffect, useState, useMemo } from 'react';
import { useSignal, isMiniAppDark, retrieveLaunchParams } from '@telegram-apps/sdk-react';
import { AppRoot } from '@telegram-apps/telegram-ui';
import { Dashboard } from './pages/Dashboard';
import { initTelegramSdk } from './utils/init';
import { apiService } from './services/api';
import { ErrorAlert } from './components/ErrorAlert';
import { LoadingPage } from './pages/LoadingPage';
import { More } from './pages/More';

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
    const params = retrieveLaunchParams();
    return (params.tgWebAppData as { user?: UserData })?.user || {};
  }, []);

  useEffect(() => {
    console.log('Before initTelegramSdk');
    initTelegramSdk();
    console.log('Before launch params');
    const launchParams = retrieveLaunchParams();
    console.log('Launch params:', launchParams);
    let initData = launchParams.tgWebAppData;

    if (!initData) {
      console.warn('No initData found, relying on mock');
      initData = launchParams.tgWebAppData; // Это может быть избыточным, убедись, что mock есть
    }

    const loadData = async () => {
      if (initData) {
        console.log('Sending login request with initData:', initData); // Логируем как есть
        try {
          const response = await apiService.login(initData); // Передаём напрямую
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
