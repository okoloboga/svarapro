import { type User } from '@telegram-apps/sdk-react';

type HeaderProps = {
  user?: User;
  balance: string;
};

export function Header({ user, balance }: HeaderProps) {
  return (
    <div className="bg-secondary shadow-lg rounded-lg p-4 mb-4 flex justify-between items-center">
      <div className="flex items-center">
        <img
          src={user?.photo_url || 'https://via.placeholder.com/64'}
          alt="Avatar"
          className="w-16 h-16 rounded-full mr-4"
        />
        <div>
          <p className="text-white font-bold">{user?.username || 'N/A'}</p>
          <p className="text-white text-sm">ID: {user?.id}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-white text-xl font-bold">{balance} USDT</p>
        <div className="flex space-x-2 mt-2">
          <button className="bg-button-fill text-white px-4 py-2 rounded-lg">Пополнить</button>
          <button className="bg-button-withdraw text-white px-4 py-2 rounded-lg">Вывести</button>
        </div>
      </div>
    </div>
  );
}
