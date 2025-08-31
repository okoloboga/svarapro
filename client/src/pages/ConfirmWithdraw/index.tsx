
import { YellowButton } from '@/components/Button/YellowButton';
import { ConfirmWithdrawProps } from '@/types/components';

export function ConfirmWithdraw({ withdrawAmount, walletAddress }: ConfirmWithdrawProps) {

  return (
    <div className="bg-primary min-h-screen flex flex-col items-center pt-4 px-4">
      <div className="w-full max-w-[331px]">
        <h2 className="text-2xl font-semibold text-white mb-4 tracking-tighter leading-tight text-left">
          Подтвердить вывод
        </h2>
        <p className="font-medium text-xs text-gray-400 mb-2 tracking-tighter leading-tight text-left">
          Адрес для вывода
        </p>
        <div className="bg-black bg-opacity-30 rounded-lg w-full h-[53px] flex items-center justify-start px-4 mb-4">
          <p className="text-white font-semibold text-sm tracking-tighter leading-tight">
            {walletAddress}
          </p>
        </div>
        <p className="font-medium text-xs text-gray-400 mb-2 tracking-tighter leading-tight text-left">
          Сеть
        </p>
        <div className="bg-black bg-opacity-30 rounded-lg w-full h-[53px] flex items-center justify-start px-4 mb-4">
          <p className="text-white font-semibold text-sm tracking-tighter leading-tight">
            TON
          </p>
        </div>
        <p className="font-medium text-xs text-gray-400 mb-2 tracking-tighter leading-tight text-left">
          Вы получите
        </p>
        <div className="bg-black bg-opacity-30 rounded-lg w-full h-[53px] flex items-center justify-start px-4 mb-4">
          <p className="text-white font-semibold text-sm tracking-tighter leading-tight">
            {withdrawAmount} USDT
          </p>
        </div>
      </div>
      <div className="mt-auto pb-6 w-[93vw]">
        <YellowButton size="lg" onClick={() => console.log('Подтвердить clicked')} className="w-full">
          Подтвердить
        </YellowButton>

      </div>
    </div>
  );
}
