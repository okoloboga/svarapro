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
      className="shadow-lg mx-auto mt-6 w-[336px] h-[108px] flex justify-between items-center p-4 relative"
      style={{
        boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)',
        borderRadius: '8px',
        background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, #2D2B31 100%)', // Градиент как бордер
        position: 'relative',
        overflow: 'hidden', // Чтобы псевдоэлемент не выходил за границы
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '1px', // Толщина бордера 1px
          background: '#48454D', // Сплошной фон внутри
          borderRadius: '8px', // Закругление внутреннего слоя
          pointerEvents: 'none', // Чтобы не мешал кликам
          zIndex: 0,
        }}
      />
      <div className="flex flex-col items-center relative z-10">
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
      <div className="text-left relative z-10">
        <div
              className="bg-[#36333B] text-left px-2 py-1 rounded-lg"
          style={{ boxShadow: 'inset 0px 0px 4px rgba(0, 0, 0, 0.25)', width: '185px', height: '30px', position: 'relative', top: '-10px' }}
        >
          <span
            className="font-inter font-semibold text-[20px] leading-[22px]"
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
