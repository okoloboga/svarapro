import { useEffect, useState, useMemo, useCallback } from 'react';
import { isMiniAppDark, retrieveLaunchParams } from '@telegram-apps/sdk-react';
import { AppRoot } from '@telegram-apps/telegram-ui';
import { io, Socket } from 'socket.io-client';
import { Dashboard } from './pages/Dashboard';
import { Deposit } from './pages/Deposit';
import { ConfirmDeposit } from './pages/ConfirmDeposit';
import { Withdraw } from './pages/Withdraw';
import { ConfirmWithdraw } from './pages/ConfirmWithdraw';
import { AddWallet } from './pages/AddWallet';
import { More } from './pages/More';
import { DepositHistory } from './pages/DepositHistory';
import { GameRoom } from './pages/GameRoom'; // Добавляем GameRoom
import { PopSuccess } from './components/PopSuccess';
import { initTelegramSdk } from './utils/init';
import { apiService } from './services/api/api';
import { ErrorAlert } from './components/ErrorAlert';
import { LoadingPage } from './components/LoadingPage';
import { useAppBackButton } from './hooks/useAppBackButton';

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
  trackerId?: string;
  currency?: string;
  roomId?: string; // Добавляем roomId для GameRoom
  [key: string]: unknown;
};

type UserData = {
  id?: number | string;
  username?: string;
  photo_url?: string;
};

interface UserProfile {
  id?: number;
  telegramId?: string;
  username?: string;
  avatar?: string | null;
  balance?: string | number;
  walletAddress?: string | null;
}

type Page = 'dashboard' | 'more' | 'deposit' | 'confirmDeposit' | 'withdraw' | 'confirmWithdraw' | 'addWallet' | 'depositHistory' | 'gameRoom';

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
  const [socket, setSocket] = useState<Socket | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleBack = useCallback(() => {
    console.log('Handling back from page:', currentPage);
    if (currentPage === 'more' || currentPage === 'deposit' || currentPage === 'withdraw' || currentPage === 'addWallet' || currentPage === 'depositHistory' || currentPage === 'gameRoom') {
      setCurrentPage('dashboard');
    } else if (currentPage === 'confirmDeposit') {
      setCurrentPage('deposit');
    } else if (currentPage === 'confirmWithdraw') {
      setCurrentPage('withdraw');
    }
  }, [currentPage]);

  useAppBackButton(
    isSdkInitialized && currentPage !== 'dashboard', 
    handleBack
  );

  const userData = useMemo(() => {
    const params = retrieveLaunchParams() as LaunchParams;
    return (params.tgWebAppData as { user?: UserData })?.user || {};
  }, []);

  const handleSetCurrentPage = (page: Page, data: PageData | null = null) => {
    console.log('Setting page:', page, 'with data:', data);
    setCurrentPage(page);
    setPageData(data);
  };

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
            const profile = await apiService.getProfile() as UserProfile;
            console.log('Profile data:', profile);
            console.log('Creating WebSocket with telegramId:', profile.telegramId);
            setBalance(
              profile.balance !== undefined
                ? typeof profile.balance === 'number'
                  ? profile.balance.toFixed(2)
                  : parseFloat(profile.balance).toFixed(2)
                : '0.00'
            );
            setWalletAddress(profile.walletAddress || null);

            if (!socket) {
              const socketInstance = io('https://svarapro.com', {
                transports: ['websocket'],
                query: { telegramId: profile.telegramId },
              });
              setSocket(socketInstance);

              socketInstance.on('connect', () => {
                console.log('WebSocket connected');
                socketInstance.emit('join', profile.telegramId);
              });

              socketInstance.on('transactionConfirmed', (data: {
                balance: string;
                amount: number;
                currency: string;
                message: string;
              }) => {
                console.log('Transaction confirmed:', data);
                setBalance(data.balance);
                setSuccessMessage(data.message);
              });

              socketInstance.on('disconnect', () => {
                console.log('WebSocket disconnected');
                setSocket(null);
              });
            }
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

    return () => {
      if (socket) {
        socket.disconnect();
        console.log('WebSocket disconnected on cleanup');
      }
    };
  }, [socket]);

  console.log('Rendering with isLoading:', isLoading, 'error:', error, 'currentPage:', currentPage, 'pageData:', pageData);

  return (
    <AppRoot appearance={isDark ? 'dark' : 'light'} platform="base">
      {isLoading ? (
        <LoadingPage isLoading={isLoading} />
      ) : error ? (
        <ErrorAlert code={undefined} customMessage={error} />
      ) : currentPage === 'more' ? (
        <More userData={userData} setCurrentPage={handleSetCurrentPage} />
      ) : currentPage === 'deposit' ? (
        <Deposit setCurrentPage={handleSetCurrentPage} />
      ) : currentPage === 'confirmDeposit' && pageData && pageData.address && pageData.trackerId ? (
        <ConfirmDeposit address={pageData.address} currency={pageData.currency ?? 'USDTTON'} trackerId={pageData.trackerId}/>
      ) : currentPage === 'withdraw' ? (
        <Withdraw
          balance={balance}
          setCurrentPage={handleSetCurrentPage}
          setWithdrawAmount={setWithdrawAmount}
        />
      ) : currentPage === 'confirmWithdraw' ? (
        <ConfirmWithdraw withdrawAmount={withdrawAmount} />
      ) : currentPage === 'addWallet' ? (
        <AddWallet />
      ) : currentPage === 'depositHistory' ? (
        <DepositHistory setCurrentPage={handleSetCurrentPage} userId={String(userData.id)} />
      ) : currentPage === 'gameRoom' && pageData && pageData.roomId ? (
        <GameRoom roomId={pageData.roomId} balance={parseFloat(balance)} socket={socket} setCurrentPage={handleSetCurrentPage} userData={userData} />
      ) : (
        <Dashboard
          onMoreClick={() => handleSetCurrentPage('more')}
          setCurrentPage={handleSetCurrentPage}
          balance={balance}
          walletAddress={walletAddress}
          socket={socket}
        />
      )}
      {successMessage && (
        <PopSuccess message={successMessage} onClose={() => setSuccessMessage(null)} />
      )}
    </AppRoot>
  );
}

export default App;
