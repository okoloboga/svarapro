import { useState, useMemo } from 'react';
import { retrieveLaunchParams, type User } from '@telegram-apps/sdk-react';
import { Header } from '../../components/Dashboard/Header';
import { Filter } from '../../components/Dashboard/Filter';
import { RoomsList } from '../../components/Dashboard/RoomsList';
import { ButtonGroup } from '../../components/Dashboard/ButtonGroup';
import { Footer } from '../../components/Footer';
import { AddWalletWindow } from '../../components/AddWalletWindow';
import { Notification } from '../../components/Notification';

type DashboardProps = {
  onMoreClick: () => void;
  setCurrentPage: (page: 'dashboard' | 'more' | 'deposit' | 'withdraw' | 'addWallet') => void; // Добавляем пропс
  balance: string;
  walletAddress: string | null;
};

export function Dashboard({ onMoreClick, setCurrentPage, balance, walletAddress }: DashboardProps) {
  console.log('walletAddress:', walletAddress);
  const userData: User | undefined = useMemo(() => {
    const params = retrieveLaunchParams();
    return (params.tgWebAppData as { user?: User })?.user;
  }, []);

  const [searchId, setSearchId] = useState('');
  const [isAvailableFilter, setIsAvailableFilter] = useState(false);
  const [stakeRange, setStakeRange] = useState<[number, number]>([0, 1000000]);
  const [isAddWalletVisible, setIsAddWalletVisible] = useState(false);
  const [notification, setNotification] = useState<'comingSoon' | null>(null);

  const handleWithdrawClick = () => {
    if (walletAddress) {
      setCurrentPage('withdraw');
    } else {
      setIsAddWalletVisible(true);
    }
  };

  const handleComingSoon = () => {
    setNotification('comingSoon');
  };

  return (
    <div className="bg-primary min-h-screen flex flex-col">
      <div className="flex-1">
        <Header user={userData} balance={balance} onWithdrawClick={handleWithdrawClick} setCurrentPage={setCurrentPage} />
        <ButtonGroup onMoreClick={onMoreClick} onComingSoonClick={handleComingSoon} />
        <Filter
          onSearchChange={setSearchId}
          onAvailabilityChange={setIsAvailableFilter}
          onRangeChange={setStakeRange}
        />
        <RoomsList
          searchId={searchId}
          isAvailableFilter={isAvailableFilter}
          stakeRange={stakeRange}
        />
      </div>
      <Footer />
      {isAddWalletVisible && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
          <AddWalletWindow 
            onClose={() => setIsAddWalletVisible(false)} 
            onAdd={() => {
              setCurrentPage('addWallet');
              setIsAddWalletVisible(false);
            }}
          />
        </div>
      )}
      <Notification type={notification} onClose={() => setNotification(null)} />
    </div>
  );
}
