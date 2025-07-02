import { useMemo } from 'react';
import { retrieveLaunchParams, type User } from '@telegram-apps/sdk-react';

export function Profile() {
  const userData: User | undefined = useMemo(() => {
    const params = retrieveLaunchParams();
    
    // Получаем пользователя напрямую. Тип User, как оказалось, уже ожидает snake_case.
    // Преобразование не требуется.
    const user = (params.tgWebAppData as { user?: User })?.user;
    
    return user;
  }, []);

  return (
    <div className="p-4">
      <div className="bg-surface rounded-lg p-4 shadow">
        <h1 className="text-xl font-bold">Profile</h1>
        {userData ? (
          <div className="mt-4">
            <img
              // Возвращаемся к snake_case, так как это реальный формат объекта userData
              src={userData.photo_url || 'https://via.placeholder.com/64'}
              alt="Avatar"
              className="w-16 h-16 rounded-full"
            />
            <p className="mt-2">Username: {userData.username || 'N/A'}</p>
            <p>Telegram ID: {userData.id}</p>
          </div>
        ) : (
          <p className="mt-2 text-error">Failed to load user data</p>
        )}
      </div>
    </div>
  );
}
