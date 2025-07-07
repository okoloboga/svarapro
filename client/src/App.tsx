import { useEffect, useState } from 'react';
import { useSignal, isMiniAppDark, retrieveLaunchParams } from '@telegram-apps/sdk-react';
import { AppRoot } from '@telegram-apps/telegram-ui';
import { Dashboard } from './pages/Dashboard';
import { initTelegramSdk } from './utils/init';
import { apiService } from './services/api';
import { ErrorAlert } from './components/ErrorAlert';

function App() {
  console.log('Launch App');
  const isDark = useSignal(isMiniAppDark);
  const [error, setError] = useState<string | null>(null);

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

    if (initData) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(initData)) {
        if (key !== 'hash' && value !== undefined) {
          params.append(key, typeof value === 'object' ? JSON.stringify(value) : value.toString());
        }
      }
      console.log('Sending login request with params:', params.toString());
      console.log('VITE_API_URL:', import.meta.env.VITE_API_URL)
      apiService.login(params.toString())
        .then((response) => {
          console.log('Login response:', response);
        })
        .catch((error) => {
          console.error('Login error:', error.response ? error.response.data : error.message);
          setError(error.message || 'Authorization failed');
        });
    } else {
      console.error('No initData available after mock check');
      setError('App not running in Telegram context or mock failed');
    }
  }, []);

  return (
    <AppRoot appearance={isDark ? 'dark' : 'light'} platform={'base'}>
      {error ? <ErrorAlert code={undefined} customMessage={error} /> : <Dashboard />}
    </AppRoot>
  );
}

export default App;
