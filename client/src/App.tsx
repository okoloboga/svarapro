import { useEffect } from 'react';
import { useSignal, isMiniAppDark } from '@telegram-apps/sdk-react';
import { AppRoot } from '@telegram-apps/telegram-ui';
import { Profile } from './pages/Profile';
import { initTelegramSdk } from './utils/init';

function App() {
  const isDark = useSignal(isMiniAppDark);

  useEffect(() => {

    initTelegramSdk();
  }, []);

  return (
    <AppRoot
      appearance={isDark ? 'dark' : 'light'}
      platform={'base'}
    >
      <Profile />
    </AppRoot>
  );
}

export default App;
