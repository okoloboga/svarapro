import { useState, useMemo } from 'react';
import { retrieveLaunchParams, type User } from '@telegram-apps/sdk-react';
import { Header } from '@/components/Dashboard/Header';
import { Filter } from '@/components/Dashboard/Filter';
import { RoomsList } from '@/components/Dashboard/RoomsList';
import { ButtonGroup } from '@/components/Dashboard/ButtonGroup';
import { Footer } from '@/components/Footer';
import { AddWalletWindow } from '@/components/AddWalletWindow';
import { Notification } from '@/components/Notification';
import EnterGameMenu from '@/components/EnterGame/EnterGameMenu';
import { CreatePublic } from '@/components/EnterGame/CreatePublic';
import { CreatePrivate } from '@/components/EnterGame/CreatePrivate';
import { ConnectRoom } from '@/components/EnterGame/ConnectRoom';
import { DashboardProps, NotificationType } from '@/types/components';

export function Dashboard({ onMoreClick, setCurrentPage, balance, walletAddress, socket }: DashboardProps) {
  console.log('Dashboard rendering, socket status:', socket ? 'connected' : 'disconnected');
  const userData: User | undefined = useMemo(() => {
    const params = retrieveLaunchParams();
    return (params.tgWebAppData as { user?: User })?.user;
  }, []);

  const [searchId, setSearchId] = useState('');
  const [isAvailableFilter, setIsAvailableFilter] = useState(false);
  const [stakeRange, setStakeRange] = useState<[number, number]>([0, 1000000]);
  const [isAddWalletVisible, setIsAddWalletVisible] = useState(false);
  const [notification, setNotification] = useState<NotificationType | null>(null);
  const [isEnterGameMenuVisible, setIsEnterGameMenuVisible] = useState(false);
  const [activeModal, setActiveModal] = useState<'createPublic' | 'createPrivate' | 'connectRoom' | null>(null);

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

  const handleCreateRoomClick = () => {
    setIsEnterGameMenuVisible(true);
  };

  const handleCloseEnterGameMenu = () => {
    setIsEnterGameMenuVisible(false);
  };

  const openModal = (modal: 'createPublic' | 'createPrivate' | 'connectRoom') => {
    setActiveModal(modal);
    setIsEnterGameMenuVisible(false);
  };

  const openEnterGameMenu = () => {
    setActiveModal(null);
    setIsEnterGameMenuVisible(true);
  };

  const closeModal = () => {
    setActiveModal(null);
  };

  return (
    <div className="bg-primary min-h-screen flex flex-col">
      <div className="flex-1">
        <Header user={userData} balance={balance} onWithdrawClick={handleWithdrawClick} setCurrentPage={setCurrentPage} />
        <ButtonGroup onMoreClick={onMoreClick} onComingSoonClick={handleComingSoon} onCreateRoomClick={handleCreateRoomClick} />
        <Filter
          onSearchChange={setSearchId}
          onAvailabilityChange={setIsAvailableFilter}
          onRangeChange={setStakeRange}
        />
        <RoomsList
          searchId={searchId}
          isAvailableFilter={isAvailableFilter}
          stakeRange={stakeRange}
          socket={socket}
          setCurrentPage={setCurrentPage}
          balance={balance}
          setNotification={setNotification}
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
      {isEnterGameMenuVisible && <EnterGameMenu onClose={handleCloseEnterGameMenu} openModal={openModal} />}
      {activeModal === 'createPublic' && <CreatePublic onClose={closeModal} openModal={openEnterGameMenu} setCurrentPage={setCurrentPage} balance={balance} />}
      {activeModal === 'createPrivate' && <CreatePrivate onClose={closeModal} openModal={openEnterGameMenu} setCurrentPage={setCurrentPage} balance={balance} setNotification={setNotification} />}
      {activeModal === 'connectRoom' && <ConnectRoom onClose={closeModal} openModal={openEnterGameMenu} setCurrentPage={setCurrentPage} />}
      <Notification type={notification} onClose={() => setNotification(null)} />
    </div>
  );
}