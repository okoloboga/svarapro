import { Button } from '../../components/Button/Button';
import tetherIcon from '../../assets/tether.png';
import tonIcon from '../../assets/ton.png';
import rightIcon from '../../assets/right.svg';

type TopUpProps = {
  onBack: () => void;
  setCurrentPage: (page: 'dashboard' | 'more' | 'deposit' | 'confirmDeposit') => void; // Добавляем пропс
};

export function Deposit({ onBack, setCurrentPage }: TopUpProps) {
  const handleDeposit = (currency: string) => {
    console.log(`Navigating to deposit for ${currency}`);
    setCurrentPage('confirmDeposit'); // Переход на ConfirmDeposit
    // Здесь можно передать валюту через контекст или состояние (пока жестко в Deposit)
  };

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
