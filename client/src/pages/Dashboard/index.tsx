import { useEffect, useState, useMemo } from 'react';
import { retrieveLaunchParams, type User } from '@telegram-apps/sdk-react';
import { apiService } from '../../services/api/api';
import { Header } from '../../components/Dashboard/Header';
import { Filter } from '../../components/Dashboard/Filter';
import { RoomsList } from '../../components/Dashboard/RoomsList';
import { ButtonGroup } from '../../components/Dashboard/ButtonGroup';
import { Footer } from '../../components/Footer';

type DashboardProps = {
  onMoreClick: () => void;
  setCurrentPage: (page: 'dashboard' | 'more' | 'deposit' | 'withdraw') => void; // Добавляем пропс
  balance: string;
};

export function Dashboard({ onMoreClick, setCurrentPage, balance }: DashboardProps) {
  const userData: User | undefined = useMemo(() => {
    const params = retrieveLaunchParams();
    return (params.tgWebAppData as { user?: User })?.user;
  }, []);

  const [searchId, setSearchId] = useState('');
  const [isAvailableFilter, setIsAvailableFilter] = useState(false);
  const [stakeRange, setStakeRange] = useState<[number, number]>([0, 1000000]);

  return (
    <div className="bg-primary min-h-screen flex flex-col">
      <div className="flex-1">
        <Header user={userData} balance={balance} setCurrentPage={setCurrentPage} /> {/* Передаём setCurrentPage */}
        <ButtonGroup onMoreClick={onMoreClick} />
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
    </div>
  );
}
