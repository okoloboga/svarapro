import { useState } from 'react';
import { Button } from '../../components/Button/Button';
import { YellowButton } from '../../components/Button/YellowButton';
import { Notification } from '../../components/Notification';
import tetherIcon from '../../assets/tether.png';
import warningIcon from '../../assets/warning.svg';
import { apiService } from '../../services/api/api';

type AddWalletProps = {
  onBack: () => void;
};

export function AddWallet({ onBack }: AddWalletProps) {
  const [address, setAddress] = useState('');
  const [notification, setNotification] = useState<'invalidAddress' | 'addressAlreadyUsed' | 'addressAdded' | null>(null);

  const handleAddWallet = async () => {
    if (address.length !== 48) {
      setNotification('invalidAddress');
      return;
    }

    try {
      await apiService.addWalletAddress(address);
      setNotification('addressAdded');
    } catch (error: unknown) {
      if (error.response && error.response.data.message === 'Wallet address already in use') {
        setNotification('addressAlreadyUsed');
      } else if (error.response && error.response.data.message === 'Invalid TON address format') {
        setNotification('invalidAddress');
      } else {
        setNotification('invalidAddress');
      }
    }
  };

  return (
    <div className="bg-primary min-h-screen flex flex-col items-center pt-4 px-4">
      <div className="w-full max-w-[336px]">
        <h2 className="text-xl font-semibold text-white mb-2 flex items-center text-left leading-tight tracking-tighter">
          Добавить USDT-TON <img src={tetherIcon} alt="USDT-TON" className="w-6 h-6 ml-2" />
        </h2>
        <p className="text-xl font-semibold text-white mb-4 text-left leading-tight tracking-tighter">
          адрес для выводов
        </p>
      </div>

      <div className="bg-black bg-opacity-30 rounded-lg px-4 w-full max-w-[336px] flex items-center mb-4 h-[53px]">
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="USDT-TON address"
          className="bg-transparent text-white text-left font-inter text-[17px] w-full focus:outline-none placeholder-white placeholder-opacity-60"
          maxLength={48}
        />
      </div>

      <div className="bg-red-900 bg-opacity-30 rounded-lg p-3 mb-4 w-full max-w-[336px] flex items-center text-left">
        <img src={warningIcon} alt="Warning" className="w-6 h-6 mr-2" />
        <span className="text-white font-inter text-xs">
          Мемо/комментарии не поддерживаются Будьте внимательны при выводе на биржевые адреса
        </span>
      </div>

      <YellowButton
        size="lg"
        onClick={handleAddWallet}
        className="w-full max-w-[336px]"
        isActive={address.length === 48}
      >
        Добавить
      </YellowButton>

      <div className="mt-auto pb-6 w-full max-w-[336px]">
        <Button variant="tertiary" onClick={onBack} fullWidth>
          Назад
        </Button>
      </div>

      <Notification type={notification} onClose={() => setNotification(null)} />
    </div>
  );
}
