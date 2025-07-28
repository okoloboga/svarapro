import { useEffect, useState, useMemo } from 'react';
import { isMiniAppDark, retrieveLaunchParams } from '@telegram-apps/sdk-react';
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
import { useAppBackButton } from './hooks/useAppBackButton';

// Определяем интерфейсы
interface LaunchParams {
  initData?: string;
  tgWebAppData?: Record<string, string | Record<string, unknown>>;
  startPayload?: string;
}

type ApiError = {
  message?: string;
  response?: {
    data?: unknown;
    status?: number;
  };
} | string;

type PageData = {
  address?: string;
  currency?: string;
  [key: string]: unknown;
};

type UserData = {
  id?: number | string;
  username?: string;
  photo_url?: string;
};

type Page = 'dashboard' | 'more' | 'deposit' | 'confirmDeposit' | 'withdraw' | 'confirmWithdraw' | 'addWallet';

function App() {
  console.log('Launch App');
  const isDark = isMiniAppDark();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSdkInitialized, setIsSdkInitialized] = useState(false);
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [balance, setBalance] = useState('0.00');
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const userData = useMemo(() => {
    const params = retrieveLaunchParams() as LaunchParams;
    console.log('Retrieved userData:', params.tgWebAppData?.user);
    return (params.tgWebAppData as { user?: UserData })?.user || {};
  }, []);

  const handleSetCurrentPage = (page: Page, data: PageData | null = null) => {
    console.log('Setting page:', page, 'with data:', data);
    setCurrentPage(page);
    setPageData(data);
  };

  const handleBack = () => {
    console.log('Handling back from page:', currentPage);
    if (currentPage === 'more' || currentPage === 'deposit' || currentPage === 'withdraw' || currentPage === 'addWallet') {
      setCurrentPage('dashboard');
    } else if (currentPage === 'confirmDeposit') {
      setCurrentPage('deposit');
    } else if (currentPage === 'confirmWithdraw') {
      setCurrentPage('withdraw');
    }
  };

  if (isSdkInitialized) {
    useAppBackButton(currentPage !== 'dashboard', handleBack);
  }

  useEffect(() => {
    console.log('Before initTelegramSdk');
    const initialize = async () => {
      try {
        await initTelegramSdk();
        setIsSdkInitialized(true);
        console.log('SDK initialization completed');
      } catch (e) {
        console.error('Failed to initialize SDK:', e);
        setError('Failed to initialize Telegram SDK');
      }

      console.log('Before launch params');
      const launchParams = retrieveLaunchParams() as LaunchParams;
      console.log('Launch params:', launchParams);

      let initData: string | undefined = launchParams.initData;
      if (!initData && launchParams.tgWebAppData) {
        initData = new URLSearchParams(
          Object.entries(launchParams.tgWebAppData)
            .filter(([key]) => key !== 'hash' && key !== 'signature')
            .map(([key, value]) => [key, (value as string | Record<string, unknown>).toString()])
        ).toString();
      }

      const loadData = async () => {
        if (initData) {
          console.log('Sending login request with initData:', initData);
          try {
            const response = await apiService.login(initData, launchParams.startPayload);
            console.log('Login response:', response);
            const profile = await apiService.getProfile();
            console.log('Profile data:', profile);
            setBalance(profile.balance || '0.00'); // Защита от undefined/null
            setWalletAddress(profile.walletAddress || null); // Защита от undefined/null
          } catch (error) {
            const apiError = error as ApiError;
            const errorMessage =
              typeof apiError === 'string'
                ? apiError
                : apiError.message || 'Unknown error';
            console.error(
              'Login error:',
              errorMessage,
              typeof apiError === 'object' && apiError.response
                ? apiError.response.data
                : 'No response data'
            );
            setError('Failed to load data. Please try again later.');
          }
        } else {
          console.error('No initData available');
          setError('Telegram initialization data not found.');
        }
        setIsLoading(false);
      };

      await loadData();
    };

    initialize();
  }, []);

  console.log('Rendering with isLoading:', isLoading, 'error:', error, 'currentPage:', currentPage);

  return (
    <AppRoot appearance={isDark ? 'dark' : 'light'} platform="base">
      {isLoading ? (
        <LoadingPage isLoading={isLoading} />
      ) : error ? (
        <ErrorAlert code={undefined} customMessage={error} />
      ) : currentPage === 'more' ? (
        <More onBack={handleBack} userData={userData} setCurrentPage={handleSetCurrentPage} />
      ) : currentPage === 'deposit' ? (
        <Deposit onBack={handleBack} setCurrentPage={handleSetCurrentPage} />
      ) : currentPage === 'confirmDeposit' && pageData && pageData.address && pageData.currency ? (
        <ConfirmDeposit onBack={handleBack} address={pageData.address} currency={pageData.currency} />
      ) : currentPage === 'withdraw' ? (
        <Withdraw
          onBack={handleBack}
          balance={balance}
          setCurrentPage={handleSetCurrentPage}
          setWithdrawAmount={setWithdrawAmount}
        />
      ) : currentPage === 'confirmWithdraw' ? (
        <ConfirmWithdraw onBack={handleBack} withdrawAmount={withdrawAmount} />
      ) : currentPage === 'addWallet' ? (
        <AddWallet onBack={handleBack} />
      ) : (
        <Dashboard
          onMoreClick={() => handleSetCurrentPage('more')}
          setCurrentPage={handleSetCurrentPage}
          balance={balance}
          walletAddress={walletAddress}
        />
      )}
      {isLoading === false && error === null && currentPage === 'dashboard' && (
        <div>Debug: Rendering Dashboard as fallback</div>
      )}
    </AppRoot>
  );
}

export default App;
