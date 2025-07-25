import { useEffect, useState, useMemo } from 'react';
import { useSignal, isMiniAppDark, retrieveLaunchParams } from '@telegram-apps/sdk-react';
import { AppRoot } from '@telegram-apps/telegram-ui';
import { Dashboard } from './pages/Dashboard';
import { Deposit } from './pages/Deposit';
import { ConfirmDeposit } from './pages/ConfirmDeposit';
import { Withdraw } from './pages/Withdraw';
import { ConfirmWithdraw } from './pages/ConfirmWithdraw';
import { AddWallet } from './pages/AddWallet';
import { initTelegramSdk } from './utils/init';
import { apiService } from './services/api/api';
import { ErrorAlert } from './components/ErrorAlert';
import { LoadingPage } from './components/LoadingPage';
import { More } from './pages/More';

// Определяем интерфейс для параметров запуска
interface LaunchParams {
  initData?: string;
  tgWebAppData?: Record<string, string | Record<string, any>>;
  startPayload? :string;
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
  const [error] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'more' | 'deposit' | 'confirmDeposit' | 'withdraw' | 'confirmWithdraw' | 'addWallet'>('dashboard');
  const [balance, setBalance] = useState('0.00');
  const [withdrawAmount, setWithdrawAmount] = useState('');
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

    let initData: string | undefined = launchParams.initData;
    let referredBy: string | undefined;
    if (!initData && launchParams.tgWebAppData) {
      initData = new URLSearchParams(
        Object.entries(launchParams.tgWebAppData)
          .filter(([key]) => key !== 'hash' && key !== 'signature')
          .map(([key, value]) => [key, (value as string | Record<string, any>).toString()])
      ).toString();
    }
    // Безопасное извлечение startPayload
    if (launchParams.startPayload && typeof launchParams.startPayload === 'string') {
      referredBy = launchParams.startPayload;
    } else if (launchParams.tgWebAppData && typeof (launchParams.tgWebAppData as any)?.startPayload === 'string') {
      referredBy = (launchParams.tgWebAppData as any).startPayload;
    }

    const loadData = async () => {
      if (initData) {
        console.log('Sending login request with initData:', initData);
        try {
          const response = await apiService.login(initData, launchParams.startPayload);
          console.log('Login response:', response);
          const profile = await apiService.getProfile();
          setBalance(profile.balance);
        } catch (error) {
          const apiError = error as ApiError;
          const errorMessage = typeof apiError === 'string' ? apiError : apiError.message || 'Unknown error';
          console.error('Login error - using mock data:', errorMessage, typeof apiError === 'object' && apiError.response ? apiError.response.data : 'No response data');
        }
      } else {
        console.error('No initData available - using mock data');
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
        <More onBack={() => setCurrentPage('dashboard')} userData={userData} setCurrentPage={setCurrentPage} />
      ) : currentPage === 'deposit' ? (
        <Deposit onBack={() => setCurrentPage('dashboard')} setCurrentPage={setCurrentPage}/>
      ) : currentPage === 'confirmDeposit' ? (
        <ConfirmDeposit onBack={() => setCurrentPage('deposit')} />
      ) : currentPage === 'withdraw' ? (
        <Withdraw onBack={() => setCurrentPage('dashboard')} balance={balance} setCurrentPage={setCurrentPage} setWithdrawAmount={setWithdrawAmount} />
      ) : currentPage === 'confirmWithdraw' ? (
        <ConfirmWithdraw onBack={() => setCurrentPage('withdraw')} withdrawAmount={withdrawAmount} />
      ) : currentPage === 'addWallet' ? (
        <AddWallet onBack={() => setCurrentPage('more')} />
      ) : (
        <Dashboard onMoreClick={() => setCurrentPage('more')} setCurrentPage={setCurrentPage} balance={balance} />
      )}
    </AppRoot>
  );
}

export default App;
