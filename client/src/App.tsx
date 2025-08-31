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
import { GameRoom } from './pages/GameRoom';
import { PopSuccess } from './components/PopSuccess';
import { initTelegramSdk } from './utils/init';
import { apiService } from './services/api/api';
import { ErrorAlert } from './components/ErrorAlert';
import { LoadingPage } from './components/LoadingPage';
import { useAppBackButton } from './hooks/useAppBackButton';
import { SoundProvider } from './context/SoundContext';
import { Notification } from './components/Notification';
import { NotificationType } from './types/components';

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
  roomId?: string;
  [key: string]: unknown;
};

type UserData = {
  id?: number | string;
  username?: string;
  first_name?: string;
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
  const [notification, setNotification] = useState<NotificationType | null>(null);

  const handleBack = useCallback(() => {
    if (currentPage === 'more' || currentPage === 'deposit' || currentPage === 'withdraw' || currentPage === 'addWallet' || currentPage === 'depositHistory' || currentPage === 'gameRoom') {
      setCurrentPage('dashboard');
    } else if (currentPage === 'confirmDeposit') {
      setCurrentPage('deposit');
    } else if (currentPage === 'confirmWithdraw') {
      setCurrentPage('withdraw');
    }
  }, [currentPage]);

  useAppBackButton(isSdkInitialized && currentPage !== 'dashboard', handleBack);

  const userData = useMemo(() => {
    const params = retrieveLaunchParams() as LaunchParams;
    return (params.tgWebAppData as { user?: UserData })?.user || {};
  }, []);

  const handleSetCurrentPage = (page: Page, data: PageData | null = null) => {
    setCurrentPage(page);
    setPageData(data);
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        await initTelegramSdk();
        setIsSdkInitialized(true);
      } catch (e) {
        console.error('Failed to initialize SDK:', e);
        setError('Failed to initialize Telegram SDK');
      }

      const launchParams = retrieveLaunchParams() as LaunchParams;

      let initData: string | undefined = launchParams.initData;
      if (!initData && launchParams.tgWebAppData) {
        initData = new URLSearchParams(
          Object.entries(launchParams.tgWebAppData)
            .filter(([key]) => key !== 'hash' && key !== 'signature')
            .map(([key, value]) => {
              if (typeof value === 'object' && value !== null) {
                return [key, JSON.stringify(value)];
              }
              return [key, value.toString()];
            })
        ).toString();
      }

      const loadData = async () => {
        if (!initData) {
          setError('Telegram initialization data not found.');
          setIsLoading(false);
          return;
        }

        try {
          let roomIdFromPayload: string | undefined = undefined;
          let referrerIdFromPayload: string | undefined = undefined;

          if (launchParams.startPayload && launchParams.startPayload.startsWith('join_')) {
            const parts = launchParams.startPayload.split('_');
            if (parts.length > 2) { // join_roomId_referrerId
              roomIdFromPayload = parts[1];
              referrerIdFromPayload = parts[2];
            }
          } else if (launchParams.startPayload) {
            referrerIdFromPayload = launchParams.startPayload;
          }

          await apiService.login(initData, referrerIdFromPayload);

          const profile = await apiService.getProfile() as UserProfile;
          setBalance(
            profile.balance !== undefined
              ? typeof profile.balance === 'number'
                ? profile.balance.toFixed(2)
                : parseFloat(profile.balance).toFixed(2)
              : '0.00'
          );
          setWalletAddress(profile.walletAddress || null);

          if (roomIdFromPayload) {
            try {
              await apiService.joinRoom(roomIdFromPayload);
              handleSetCurrentPage('gameRoom', { roomId: roomIdFromPayload, autoSit: true });
            } catch (error) {
              const axiosError = error as any;
              const errorMessage = axiosError.response?.data?.message || '';
              if (errorMessage.toLowerCase().includes('insufficient') || errorMessage.toLowerCase().includes('funds')) {
                handleSetCurrentPage('deposit');
              } else {
                console.error('Failed to join room:', error);
                setCurrentPage('dashboard');
                setNotification('gameJoinError');
              }
            }
          }

          if (!socket) {
            const socketInstance = io('https://svarapro.com', {
              transports: ['websocket'],
              query: { telegramId: profile.telegramId },
            });
            setSocket(socketInstance);

            socketInstance.on('connect', () => {
              socketInstance.emit('join', profile.telegramId);
              socketInstance.emit('subscribe_balance', profile.telegramId);
            });

            socketInstance.on('transactionConfirmed', (data: { balance: string; message: string; }) => {
              setBalance(data.balance);
              setSuccessMessage(data.message);
            });

            socketInstance.on('balanceUpdated', (data: { balance: string }) => {
              setBalance(data.balance);
            });

            socketInstance.on('disconnect', () => {
              setSocket(null);
            });
          }
        } catch (error) {
          const apiError = error as ApiError;
          const errorMessage = typeof apiError === 'string' ? apiError : apiError.message || 'Unknown error';
          console.error('Login error:', errorMessage, typeof apiError === 'object' && apiError.response ? apiError.response.data : 'No response data');
          setError('Failed to load data. Please try again later.');
        }
        setIsLoading(false);
      };

      await loadData();
    };

    initialize();

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [socket]);

  return (
    <AppRoot appearance={isDark ? 'dark' : 'light'} platform="base">
      <SoundProvider>
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
          <Withdraw balance={balance} setCurrentPage={handleSetCurrentPage} setWithdrawAmount={setWithdrawAmount} />
        ) : currentPage === 'confirmWithdraw' ? (
          <ConfirmWithdraw withdrawAmount={withdrawAmount} walletAddress={walletAddress || ''} />
        ) : currentPage === 'addWallet' ? (
          <AddWallet setCurrentPage={handleSetCurrentPage} setWalletAddress={setWalletAddress} />
        ) : currentPage === 'depositHistory' ? (
          <DepositHistory setCurrentPage={handleSetCurrentPage} userId={String(userData.id)} />
        ) : currentPage === 'gameRoom' && pageData && pageData.roomId ? (
          <GameRoom roomId={pageData.roomId} balance={balance} socket={socket} setCurrentPage={handleSetCurrentPage} userData={userData} pageData={pageData} />
        ) : (
          <Dashboard onMoreClick={() => handleSetCurrentPage('more')} setCurrentPage={handleSetCurrentPage} balance={balance} walletAddress={walletAddress} socket={socket} />
        )}
        {successMessage && <PopSuccess message={successMessage} onClose={() => setSuccessMessage(null)} />}
        {notification && <Notification type={notification} onClose={() => setNotification(null)} />}
      </SoundProvider>
    </AppRoot>
  );
}

export default App;
