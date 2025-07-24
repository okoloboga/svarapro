import { useState } from 'react';
import { Button } from '../../components/Button/Button';
import { YellowButton } from '../../components/Button/YellowButton';
import tetherIcon from '../../assets/tether.png';
import warningIcon from '../../assets/warning.svg';

type WithdrawProps = {
  onBack: () => void;
  balance: string;
  setCurrentPage: (page: 'dashboard' | 'more' | 'deposit' | 'confirmDeposit' | 'withdraw' | 'confirmWithdraw') => void;
  setWithdrawAmount: (amount: string) => void;
};

export function Withdraw({ onBack, balance, setCurrentPage, setWithdrawAmount }: WithdrawProps) {
  const [amount, setAmount] = useState('');
  const minAmount = 10;
  const availableAmount = parseFloat(balance);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only positive integers
    if (/^\d*$/.test(value)) {
      setAmount(value);
    }
  };

  const handleCheck = () => {
    setWithdrawAmount(amount);
    setCurrentPage('confirmWithdraw');
  };

  return (
    <div className="bg-primary min-h-screen flex flex-col items-center pt-4 px-4">
      <div className="w-full max-w-[336px]">
        <h2 className="text-lg font-semibold text-white mb-2 flex items-center text-left">
          Вывод на USDT-TON <img src={tetherIcon} alt="USDT-TON" className="w-6 h-6 ml-2" />
        </h2>
        <div className="bg-red-900 bg-opacity-30 rounded-lg p-3 mb-4 w-full flex items-center text-left">
          <img src={warningIcon} alt="Warning" className="w-6 h-6 mr-2" />
          <span className="text-white font-inter text-xs">
            Мемо/комментарии не поддерживаются Будьте внимательны при выводе на биржевые адреса
          </span>
        </div>
      </div>

      {/* Контейнер с инпутом */}
      <div className="bg-black bg-opacity-30 rounded-lg px-4 w-full max-w-[336px] flex items-center mb-4 h-[53px]">
        <span className="text-white font-inter text-[17px] opacity-60">$</span>
        <input
          type="text"
          value={amount}
          onChange={handleAmountChange}
          placeholder="0"
          className="bg-transparent text-white text-left font-inter text-[17px] w-full focus:outline-none mx-2 placeholder-white placeholder-opacity-60"
        />
        <Button
          variant="tertiary"
          size="sm"
          onClick={() => console.log('Max button clicked')}
          className="!h-[25px] !w-[57px] !px-2 !py-1 !rounded-lg !bg-[#2E2B33] !text-[#C9C6CE] !font-medium !text-[14px]"
        >
          Макс
        </Button>
      </div>

      {/* Мин.сумма и Доступно */}
      <div className="w-full max-w-[336px] text-sm text-[#C9C6CE] mb-4 font-semibold tracking-tighter text-[12px]">
        <div className="flex justify-between">
          <span className="text-left">Мин.сумма:</span>
          <span className="text-right">${minAmount} USDT</span>
        </div>
        <div className="flex justify-between">
          <span className="text-left">Доступно</span>
          <span className="text-right">${availableAmount} USDT</span>
        </div>
      </div>

      <YellowButton
        size="lg"
        onClick={handleCheck}
        isActive={true} // Кнопка всегда активна для теста
        className="w-full max-w-[336px]"
      >
        Проверить
      </YellowButton>

      <div className="mt-auto pb-6 w-full max-w-[336px]">
        <Button variant="tertiary" onClick={onBack} fullWidth>
          Назад
        </Button>
      </div>
    </div>
  );
}
