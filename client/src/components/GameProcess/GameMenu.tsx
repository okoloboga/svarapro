import { useState } from 'react';
import exitIcon from '../../assets/game/exit.svg';
import { StyledContainer } from '../StyledContainer';
import { GameMenuProps } from '@/types/components';
import { ExitMenu } from './ExitMenu';

export function GameMenu({ isOpen, onClose, onExit }: GameMenuProps) {
  const [showExitMenu, setShowExitMenu] = useState(false);

  if (!isOpen) return null;

  const handleExitClick = () => {
    setShowExitMenu(true);
  };

  const handleExitConfirm = () => {
    setShowExitMenu(false);
    onExit();
  };

  const handleExitCancel = () => {
    setShowExitMenu(false);
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="w-[250px] h-[192px]"
        onClick={(e) => e.stopPropagation()}
      >
        <StyledContainer 
          className="w-full h-full rounded-lg"
          contentClassName="flex flex-col items-center justify-center p-4"
        >
          <button
            onClick={handleExitClick}
            className="w-[225px] h-8 rounded-lg flex items-center justify-start px-3 space-x-2 transition-all duration-200 ease-in-out hover:opacity-80"
            style={{
              backgroundColor: 'rgba(19, 18, 23, 0.7)',
            }}
          >
            <img 
              src={exitIcon} 
              alt="Выйти" 
              className="w-4 h-4"
            />
            <span 
              className="text-white"
              style={{
                fontWeight: 500,
                fontStyle: 'normal',
                fontSize: '12px',
                lineHeight: '150%',
                letterSpacing: '-1.1%',
                verticalAlign: 'middle',
              }}
            >
              Выйти
            </span>
          </button>
        </StyledContainer>
      </div>
      
      {/* Модальное окно подтверждения выхода */}
      {showExitMenu && (
        <ExitMenu 
          onClose={handleExitCancel}
          onConfirm={handleExitConfirm}
        />
      )}
    </div>
  );
}
