import { useState } from 'react';
import { Button } from '../../components/Button/Button';
import tetherIcon from '../../assets/tether.png';
import tonIcon from '../../assets/ton.png';
import rightIcon from '../../assets/right.svg';
import { apiService } from '../../services/api/api';
import { LoadingPage } from '../../components/LoadingPage';

type TopUpProps = {
  onBack: () => void;
  setCurrentPage: (page: 'dashboard' | 'more' | 'deposit' | 'confirmDeposit', data?: Record<string, unknown>) => void;
};

export function Deposit({ onBack, setCurrentPage }: TopUpProps) {
  const [loading, setLoading] = useState(false);

  const handleDeposit = async (currency: string) => {
    setLoading(true);
    try {
      const depositData = await apiService.initiateDeposit(currency);
      setCurrentPage('confirmDeposit', { ...depositData, currency });
    } catch (error) {
      console.error('Failed to initiate deposit:', error);
      // Тут можно показать ошибку
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingPage isLoading={loading} />;
  }

  return (
    <div className="bg-primary min-h-screen flex flex-col items-center pt-4 px-4">
      <h2 className="text-lg font-semibold text-gray-400 mb-4">
        Выберите валюту
      </h2>

      <div className="w-full max-w-[336px] flex flex-col items-start space-y-3">
        <Button
          variant="secondary"
          fullWidth
          icon={tetherIcon}
          rightIcon={rightIcon}
          onClick={() => handleDeposit('USDT-TON')}
          justify="start"
        >
          USDT-TON
        </Button>
        <Button
          variant="secondary"
          fullWidth
          icon={tonIcon}
          rightIcon={rightIcon}
          onClick={() => handleDeposit('TON')}
          justify="start"
        >
          TON
        </Button>
      </div>

      <div className="mt-auto pt-6 w-full max-w-md">
        <Button variant="tertiary" onClick={onBack} fullWidth>
          Назад
        </Button>
      </div>
    </div>
  );
}
