import { useState } from 'react';
import { Button } from '../../components/Button/Button';
import tetherIcon from '../../assets/tether.png';
import tonIcon from '../../assets/ton.png';
import rightIcon from '../../assets/right.svg';
import { apiService } from '../../services/api/api';
import { LoadingPage } from '../../components/LoadingPage';
import { useTranslation } from 'react-i18next';
import { ErrorAlert } from '../../components/ErrorAlert';

type Page = 'dashboard' | 'more' | 'deposit' | 'confirmDeposit' | 'withdraw' | 'confirmWithdraw' | 'addWallet' | 'depositHistory';

type TopUpProps = {
  setCurrentPage: (page: Page, data?: Record<string, unknown>) => void;
};

export function Deposit({ setCurrentPage }: TopUpProps) {
  const { t } = useTranslation('common');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDeposit = async (currency: string) => {
    setLoading(true);
    setError(null);
    try {
      const depositData = await apiService.initiateDeposit(currency);
      console.log('Deposit data received:', depositData);
      setCurrentPage('confirmDeposit', {
        address: depositData.address,
        trackerId: depositData.trackerId, // Преобразуем tracker_id в trackerId
        currency, // Явно задаем currency из аргумента
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initiate deposit';
      console.error('Failed to initiate deposit:', error);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingPage isLoading={loading} />;
  }

  if (error) {
    return <ErrorAlert code={undefined} customMessage={error} />;
  }

  return (
    <div className="bg-primary min-h-screen flex flex-col items-center pt-4 px-4">
      <h2 className="text-lg font-semibold text-gray-400 mb-4">
        {t('select_currency')}
      </h2>

      <div className="w-[95vw] flex flex-col items-start space-y-3">
        <Button
          variant="secondary"
          fullWidth
          icon={tetherIcon}
          rightIcon={rightIcon}
          onClick={() => handleDeposit('USDTTON')}
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
    </div>
  );
}
