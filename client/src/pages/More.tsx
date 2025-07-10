import { MoreButton } from '../components/MoreButton';
import sharpIcon from '../assets/sharp.png';
import languageIcon from '../assets/language.png';
import depositHistoryIcon from '../assets/deposit_history.png';
import refIcon from '../assets/ref.png';
import channelIcon from '../assets/channel.png';
import licenseIcon from '../assets/license.png';
import helpIcon from '../assets/help.png';
import supportIcon from '../assets/support.png';
import { useMemo } from 'react';

type UserData = {
  id?: number | string; // Учитываем, что ID может быть числом или строкой
  username?: string;
  photo_url?: string;
};

type MoreProps = {
  onBack: () => void;
  userData?: UserData; // Добавляем пропс для передачи userData
};

export function More({ onBack, userData }: MoreProps) {
  const userId = useMemo(() => userData?.id?.toString() || 'N/A', [userData?.id]);

  return (
    <div className="bg-[#2E2B33] min-h-screen p-5">
      <div className="max-w-md mx-auto flex flex-col items-center">
        <div className="relative w-[336px]">
          <MoreButton icon={sharpIcon} label="Мой ID" />
          <span
            className="absolute top-1/2 right-4 transform -translate-y-1/2 font-inter font-medium text-sm leading-[150%] tracking-[-0.011em] text-right text-[#BBB9BD]"
            style={{ width: '82px', height: '36px' }}
          >
            {userId}
          </span>
        </div>
        <MoreButton icon={languageIcon} label="Текущий язык" />
        <MoreButton icon={depositHistoryIcon} label="История Депозитов" />
        <MoreButton icon={refIcon} label="Партнёрская программа" />
        <MoreButton icon={channelIcon} label="Новостной канал" />
        <MoreButton icon={licenseIcon} label="Пользовательское соглашение" />
        <MoreButton icon={helpIcon} label="Как играть" />
        <MoreButton icon={supportIcon} label="Чат с поддержкой" />
        
        <button
          onClick={onBack}
          className="w-[80px] h-[40px] flex items-center px-4 relative rounded-lg mt-6"
          style={{
            boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)',
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, #2D2B31 100%)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: '1px',
              background: '#46434B',
              borderRadius: '7px',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
          <span className="text-white text-center relative z-10">Назад</span>
        </button>
      </div>
    </div>
  );
}
