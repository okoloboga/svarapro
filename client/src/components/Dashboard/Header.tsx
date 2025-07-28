import { type User } from '@telegram-apps/sdk-react';
import { StyledContainer } from '../StyledContainer';
import { GreenButton } from '../Button/GreenButton';
import { RedButton } from '../Button/RedButton';

type HeaderProps = {
  user?: User;
  balance: string;
  onWithdrawClick: () => void;
  setCurrentPage: (page: 'deposit') => void;
};

export function Header({ user, balance, onWithdrawClick, setCurrentPage }: HeaderProps) {
  const safeBalance = typeof balance === 'string' ? balance : '0.00';
  const [whole, decimal = '00'] = safeBalance.split('.');
  const formattedBalance = `$ ${whole}.${decimal}`;

  return (
    <StyledContainer 
      className="mx-auto mt-6 w-[336px] h-[108px]"
      contentClassName="w-full h-full flex justify-between items-center p-4"
    >
      <div className="flex flex-col items-center">
        <img
          src={user?.photo_url || 'https://via.placeholder.com/64'}
          alt="Avatar"
          className="w-[48.39px] h-[48.39px] rounded-full mb-2"
        />
        <p
          className="text-white font-inter font-semibold text-[14px] leading-[21px] text-center"
          style={{ letterSpacing: '-0.011em', textShadow: '0px 1px 2px rgba(0, 0, 0, 0.3), 0px 1px 3px rgba(0, 0, 0, 0.15)' }}
        >
          {user?.username || 'N/A'}
        </p>
      </div>
      <div className="text-left">
        <div
          className="bg-[#36333B] text-left px-2 py-1 rounded-lg flex items-baseline"
          style={{ boxShadow: 'inset 0px 0px 4px rgba(0, 0, 0, 0.25)', width: '185px', height: '30px', position: 'relative', top: '-10px' }}
        >
          <span
            className="font-inter font-semibold text-[20px] text-white"
          >
            {formattedBalance.split('.')[0]}
          </span>
          <span
            className="font-inter font-semibold text-[15px] text-gray-400"
          >
            .{formattedBalance.split('.')[1]}
          </span>
        </div>
        <div className="flex space-x-2 mt-4">
          <GreenButton onClick={() => setCurrentPage('deposit')}>
            Пополнить
          </GreenButton>
          <RedButton onClick={onWithdrawClick}>
            Вывести
          </RedButton>
        </div>
      </div>
    </StyledContainer>
  );
}
