import { useEffect, useState } from 'react';
import { useSignal, isMiniAppDark } from '@telegram-apps/sdk-react';
import { AppRoot } from '@telegram-apps/telegram-ui';
import { Dashboard } from './pages/Dashboard';
import { initTelegramSdk } from './utils/init';
import { apiService } from './services/api';
import { retrieveLaunchParams } from '@telegram-apps/sdk-react';
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
    const initData = launchParams.tgWebAppData;
    if (initData) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(initData)) {
        if (key !== 'hash' && value !== undefined) {
          params.append(key, typeof value === 'object' ? JSON.stringify(value) : value.toString());
        }
      }
      console.log('Sending login request with params:', params.toString());
      apiService.login(params.toString()).then((response) => {
        console.log('Login response:', response);
      }).catch((error) => {
        console.error('Login error:', error.response ? error.response.data : error.message);
        setError(error.message || 'Authorization failed');
      });
    } else {
      console.warn('No initData found, check mocks or Telegram context');
    }
  }, []);

  return (
    <AppRoot appearance={isDark ? 'dark' : 'light'} platform={'base'}>
      {error ? <ErrorAlert code={undefined} customMessage={error} /> : <Dashboard />}
    </AppRoot>
  );
}

export default App;
