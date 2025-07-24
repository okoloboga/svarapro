import { useState, useEffect } from 'react';
import { Button } from '../../components/Button/Button';
import { YellowButton } from '../../components/Button/YellowButton';
import tetherIcon from '../../assets/tether.png';
import copyIcon from '../../assets/copy.svg';
import qrIcon from '../../assets/qr.png';
import slideDownIcon from '../../assets/slide-down.svg';
import warningIcon from '../../assets/warning.svg';

type DepositProps = {
  onBack: () => void;
};

export function ConfirmDeposit({ onBack }: DepositProps) {
  const [currency] = useState('USDT-TON'); // Заглушка, заменить на пропс из TopUp
  const [walletAddress] = useState('TQxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'); // Заглушка адреса
  const [timeLeft, setTimeLeft] = useState(60 * 60); // 60 минут в секундах

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="bg-primary min-h-screen flex flex-col items-center pt-4 px-4">
      <div className="w-full max-w-[336px]">
        <h2 className="text-lg font-semibold text-white mb-2 flex items-center text-left">
          Пополнение с {currency} <img src={tetherIcon} alt={currency} className="w-6 h-6 ml-2" />
        </h2>
        <p className="font-inter font-medium text-sm leading-normal tracking-tight text-gray-400 text-left mb-4">
          Отправляй по этому адресу только {currency}, иначе средства могут быть утеряны.
        </p>
        <div className="bg-red-900 bg-opacity-30 rounded-lg p-3 mb-4 w-full flex items-center text-left">
          <img src={warningIcon} alt="Warning" className="w-6 h-6 mr-2" />
          <span className="text-white font-inter text-xs">
            Это временный адрес для депозита, осталось минут: {minutes}:{seconds < 10 ? '0' : ''}{seconds}
          </span>
        </div>
      </div>

      {/* Контейнер с адресом */}
      <div className="bg-black bg-opacity-30 rounded-lg p-4 w-full max-w-[336px] flex flex-col items-center mb-4">
        <Button 
          variant="secondary" 
          size="sm" 
          onClick={() => console.log('Show QR clicked')}
          icon={qrIcon}
          rightIcon={slideDownIcon}
        >
          Показать QR
        </Button>
        <p className="text-white font-inter text-sm text-center break-all">{walletAddress}</p>
      </div>

      {/* Кнопка копирования */}
      <YellowButton
        size="lg" // Установлен размер lg для высоты 47px
        icon={copyIcon}
        iconPosition="left"
        onClick={() => navigator.clipboard.writeText(walletAddress).then(() => console.log('Address copied'))}
        className="w-full max-w-[336px]"
      >
        Скопировать адрес
      </YellowButton>

      {/* Минимальная сумма и комиссия */}
      <div className="w-full max-w-[336px] text-sm text-[#C9C6CE] mb-4 font-semibold tracking-tighter text-[12px]">
        <div className="flex justify-between">
          <span className="text-left">Минимальная сумма:</span>
          <span className="text-right">5$ USDT</span>
        </div>
        <div className="flex justify-between">
          <span className="text-left">Комиссия:</span>
          <span className="text-right">1%</span>
        </div>
      </div>

      <div className="mt-auto pb-6 w-full max-w-[336px]">
        <Button variant="tertiary" onClick={onBack} fullWidth>
          Назад
        </Button>
      </div>
    </div>
  );
}
