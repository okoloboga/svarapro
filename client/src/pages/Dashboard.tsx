import { useEffect, useState, useMemo } from 'react';
import { retrieveLaunchParams, type User } from '@telegram-apps/sdk-react';
import { apiService } from '../services/api';
import { Header } from '../components/Header';
import { Filter } from '../components/Filter';
import { RoomsList } from '../components/RoomsList';

export function Dashboard() {
  const userData: User | undefined = useMemo(() => {
    const params = retrieveLaunchParams();
    return (params.tgWebAppData as { user?: User })?.user;
  }, []);

  const [profileData, setProfileData] = useState<{ balance: string }>({ balance: '0.00' });

  useEffect(() => {
    apiService.getProfile()
      .then((data) => setProfileData(data))
      .catch((error) => {
        console.error('Profile fetch error:', error);
        setProfileData({ balance: '0.00' }); // Фallback при ошибке
      });
  }, []);

  return (
    <div className="p-4 bg-primary min-h-screen">
      <Header user={userData} balance={profileData.balance} />
      <Filter />
      <RoomsList />
    </div>
  );
}
