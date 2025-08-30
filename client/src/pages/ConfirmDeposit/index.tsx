import { useState, useEffect } from 'react';
import { Button } from '@/components/Button/Button';
import { YellowButton } from '@/components/Button/YellowButton';
import tetherIcon from '@/assets/tether.png';
import copyIcon from '@/assets/copy.png';
import qrIcon from '@/assets/qr.png';
import slideDownIcon from '@/assets/slideDown.png';
import warningIcon from '@/assets/warning.svg';
import { QRCodeCanvas } from 'qrcode.react';
import { PopSuccess } from '@/components/PopSuccess';
import { ConfirmDepositProps } from '@/types/components';

export function ConfirmDeposit({ address, currency, trackerId }: ConfirmDepositProps) {
  const [timeLeft, setTimeLeft] = useState(60 * 60); // 60 минут в секундах
  const [showQR, setShowQR] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(address).then(() => {
      setShowSuccess(true);
    });
  };

  const handleCopyTrackerId = () => {
    navigator.clipboard.writeText(trackerId).then(() => {
      setShowSuccess(true);
    });
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const paymentUrl = `ton://transfer/${address}`;

  // Сокращаем trackerId (первые 8 и последние 8 символов)
  const shortTrackerId = trackerId.length > 16
    ? `${trackerId.slice(0, 8)}...${trackerId.slice(-8)}`
    : trackerId;

  return (
    <div className="bg-primary min-h-screen flex flex-col items-center pt-4 px-4">
      {showSuccess && <PopSuccess onClose={() => setShowSuccess(false)} />}
      <div className="w-[93vw]">
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

      {/* Контейнер с адресом и trackerId */}
      <div className="bg-black bg-opacity-30 rounded-lg p-4 w-[93vw] flex flex-col items-center mb-4">
        <Button 
          variant="secondary" 
          size="sm" 
          onClick={() => setShowQR(!showQR)}
          icon={qrIcon}
          rightIcon={slideDownIcon}
        >
          {showQR ? 'Скрыть QR' : 'Показать QR'}
        </Button>
        {showQR && (
          <div className="mt-4">
            <QRCodeCanvas value={paymentUrl} size={128} bgColor="#000" fgColor="#fff" />
          </div>
        )}
        <p className="text-white font-inter text-sm text-center break-all mt-4">
          <span className="font-semibold">Адрес:</span> {address}
        </p>
        <div className="flex items-center mt-2">
          <p className="text-white font-inter text-sm text-center">
            <span className="font-semibold">Tracker ID:</span> {shortTrackerId}
          </p>
          <img
            src={copyIcon}
            alt="Copy Tracker ID"
            className="w-5 h-5 ml-2 cursor-pointer"
            onClick={handleCopyTrackerId}
          />
        </div>
      </div>

      {/* Кнопка копирования адреса */}
      <YellowButton
        size="lg"
        icon={copyIcon}
        iconPosition="left"
        onClick={handleCopyAddress}
        className="w-[93vw]"
      >
        Скопировать адрес
      </YellowButton>

      {/* Минимальная сумма и комиссия */}
      <div className="w-[93vw] text-sm text-[#C9C6CE] mb-4 font-semibold tracking-tighter text-[12px]">
        <div className="flex justify-between">
          <span className="text-left">Минимальная сумма:</span>
          <span className="text-right">5$ USDT</span>
        </div>
        <div className="flex justify-between">
          <span className="text-left">Комиссия:</span>
          <span className="text-right">1%</span>
        </div>
      </div>
    </div>
  );
}
