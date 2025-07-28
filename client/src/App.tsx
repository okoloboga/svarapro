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
import { useAppBackButton } from './hooks/useAppBackButton';

// Определяем интерфейс для параметров запуска
interface LaunchParams {
  initData?: string;
  tgWebAppData?: Record<string, string | Record<string, unknown>>;
  startPayload? :string;
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

function App() {
  console.log('Launch App');
  const isDark = useSignal(isMiniAppDark);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'more' | 'deposit' | 'confirmDeposit' | 'withdraw' | 'confirmWithdraw' | 'addWallet'>('dashboard');
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [pageHistory, setPageHistory] = useState<string[]>(['dashboard']);
  const [balance, setBalance] = useState('0.00');
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const userData = useMemo(() => {
    const params = retrieveLaunchParams() as LaunchParams;
    return (params.tgWebAppData as { user?: UserData })?.user || {};
  }, []);

  const handleSetCurrentPage = (page: 'dashboard' | 'more' | 'deposit' | 'confirmDeposit' | 'withdraw' | 'confirmWithdraw' | 'addWallet', data: PageData | null = null) => {
    setCurrentPage(page);
    setPageData(data);
    setPageHistory([...pageHistory, page]);
  };

  const handleBack = () => {
    if (currentPage === 'more' || currentPage === 'deposit' || currentPage === 'withdraw') {
      setCurrentPage('dashboard');
    } else if (currentPage === 'confirmDeposit') {
      setCurrentPage('deposit');
    } else if (currentPage === 'confirmWithdraw') {
      setCurrentPage('withdraw');
    } else if (currentPage === 'addWallet') {
      setCurrentPage('more');
    }
  };

  const { showButton, hideButton } = useAppBackButton(handleBack);

  useEffect(() => {
    if (currentPage !== 'dashboard') {
      showButton();
    } else {
      hideButton();
    }
<<<<<<< HEAD
  }, [currentPage, showButton, hideButton]);

  console.log('Rendering with isLoading:', isLoading, 'error:', error, 'currentPage:', currentPage);

  return (
    <AppRoot appearance={isDark ? 'dark' : 'light'} platform={'base'}>
      {isLoading ? (
        <LoadingPage isLoading={isLoading} />
      ) : error ? (
        <ErrorAlert code={undefined} customMessage={error} />
      ) : currentPage === 'more' ? (
        <More onBack={handleBack} userData={userData} setCurrentPage={handleSetCurrentPage} />
      ) : currentPage === 'deposit' ? (
        <Deposit onBack={handleBack} setCurrentPage={handleSetCurrentPage}/>
      ) : currentPage === 'confirmDeposit' && pageData && pageData.address && pageData.currency ? (
        <ConfirmDeposit onBack={handleBack} address={pageData.address} currency={pageData.currency} />
      ) : currentPage === 'withdraw' ? (
        <Withdraw onBack={handleBack} balance={balance} setCurrentPage={handleSetCurrentPage} setWithdrawAmount={setWithdrawAmount} />
      ) : currentPage === 'confirmWithdraw' ? (
        <ConfirmWithdraw onBack={handleBack} withdrawAmount={withdrawAmount} />
      ) : currentPage === 'addWallet' ? (
        <AddWallet onBack={handleBack} />
      ) : (
        <Dashboard onMoreClick={() => handleSetCurrentPage('more')} setCurrentPage={handleSetCurrentPage} balance={balance} walletAddress={walletAddress} />
      )}
    </AppRoot>
  );
}

export default App;
