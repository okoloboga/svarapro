import { useEffect, useState, useMemo } from 'react';
import { retrieveLaunchParams, type User } from '@telegram-apps/sdk-react';
import { apiService } from '../services/api';
import { Header } from '../components/Header';
import { Filter } from '../components/Filter';
import { RoomsList } from '../components/RoomsList';
import { ButtonGroup } from '../components/ButtonGroup';
import { Footer } from '../components/Footer';

type DashboardProps = {
  onMoreClick: () => void; // Пропс для перехода на More
};

export function Dashboard({ onMoreClick }: DashboardProps) {
  const userData: User | undefined = useMemo(() => {
    const params = retrieveLaunchParams();
    return (params.tgWebAppData as { user?: User })?.user;
  }, []);

  const [profileData, setProfileData] = useState<{ balance: string }>({ balance: '0.00' });
  const [searchId, setSearchId] = useState('');
  const [isAvailableFilter, setIsAvailableFilter] = useState(false);
  const [stakeRange, setStakeRange] = useState<[number, number]>([0, 1000000]); // Начальный диапазон

  useEffect(() => {
    apiService.getProfile()
      .then((data) => {
        setProfileData(data);
      })
      .catch((error) => {
        console.error('Profile fetch error:', error);
        setProfileData({ balance: '0.00' }); // Fallback при ошибке
      });
  }, []);

  return (
    <div className="bg-primary min-h-screen flex flex-col">
      <div className="flex-1">
        <Header user={userData} balance={profileData.balance} />
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
