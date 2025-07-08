import { type User } from '@telegram-apps/sdk-react';

type HeaderProps = {
  user?: User;
  balance: string;
};

export function Header({ user, balance }: HeaderProps) {
  // Проверка и разбиение balance с защитой от некорректных данных
  const safeBalance = typeof balance === 'string' ? balance : '0.00';
  const [whole, decimal = '00'] = safeBalance.split('.');
  const formattedBalance = `$ ${whole}.${decimal}`; // Всегда два знака после запятой

  return (
    <div
      className="bg-gradient-to-b from-[#36333B] via-[#46434B] to-[#48454D] shadow-lg rounded-lg mx-auto mt-6 w-[336px] h-[108px] flex justify-between items-center p-4"
      style={{ boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)' }}
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
          className="bg-[rgba(19,18,23,0.34)] text-left px-2 py-1 rounded-lg"
          style={{ boxShadow: 'inset 0px 0px 4px rgba(0, 0, 0, 0.25)', width: '185px', height: '30px', position: 'relative', top: '-10px' }}
        >
          <span
            className="font-inter font-semibold text-[15px] leading-[22px]"
            style={{ letterSpacing: '-0.011em', color: '#FFFFFF' }}
          >
            {formattedBalance.split('.')[0]} {/* Целая часть */}
          </span>
          <span
            className="font-inter font-semibold text-[15px] leading-[22px]"
            style={{ letterSpacing: '-0.011em', color: '#999999' }}
          >
            .{formattedBalance.split('.')[1]} {/* Дробная часть */}
          </span>
        </div>
        <div className="flex space-x-2 mt-4">
          <button
            className="bg-button-fill text-white rounded-lg w-[85px] h-[28px] flex items-center justify-center"
            style={{ textShadow: '0px 1px 2px rgba(0, 0, 0, 0.3), 0px 1px 3px rgba(0, 0, 0, 0.15)' }}
          >
            <span className="font-inter font-semibold text-[13px] leading-[20px] text-center">
              Пополнить
            </span>
          </button>
          <button
            className="bg-button-withdraw text-white rounded-lg w-[85px] h-[28px] flex items-center justify-center"
            style={{ textShadow: '0px 1px 2px rgba(0, 0, 0, 0.3), 0px 1px 3px rgba(0, 0, 0, 0.15)' }}
          >
            <span className="font-inter font-semibold text-[13px] leading-[20px] text-center">
              Вывести
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
