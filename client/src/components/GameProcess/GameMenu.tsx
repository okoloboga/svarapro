import { useState } from 'react';
import exitIcon from '../../assets/game/exit.svg';
import vibroIcon from '../../assets/game/vibro.svg';
import volumeIcon from '../../assets/game/volume.svg';
import { StyledContainer } from '../StyledContainer';
import { GameMenuProps } from '@/types/components';
import { ExitMenu } from './ExitMenu';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useSound } from '@/hooks/useSound';

export function GameMenu({ isOpen, onClose, onExit }: GameMenuProps) {
  const [showExitMenu, setShowExitMenu] = useState(false);
  const { isHapticEnabled, toggleHaptic } = useHapticFeedback();
  const { isSoundEnabled, toggleSound } = useSound();

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
          contentClassName="flex flex-col items-center justify-center p-4 space-y-2"
        >
          {/* Vibration Toggle - temporarily hidden */}
          {false && (
            <div
              className="w-[225px] h-8 rounded-lg flex items-center justify-between px-3 transition-all duration-200 ease-in-out"
              style={{ backgroundColor: 'rgba(19, 18, 23, 0.7)' }}
            >
              <div className="flex items-center space-x-2">
                <img src={vibroIcon} alt="Вибрация" className="w-4 h-4" />
                <span className="text-white" style={{ fontWeight: 500, fontSize: '12px' }}>Вибрация</span>
              </div>
              <div
                className="relative w-[40px] h-[20px] rounded-full flex items-center p-0.5 cursor-pointer transition-colors duration-300"
                style={{ background: isHapticEnabled ? '#31EA3D' : '#2F2E35' }}
                onClick={toggleHaptic}
              >
                <div
                  className="w-[16px] h-[16px] bg-white rounded-full transition-all duration-300"
                  style={{ transform: isHapticEnabled ? 'translateX(20px)' : 'translateX(0)' }}
                ></div>
              </div>
            </div>
          )}

          {/* Sound Toggle */}
          <div
            className="w-[225px] h-8 rounded-lg flex items-center justify-between px-3 transition-all duration-200 ease-in-out"
            style={{ backgroundColor: 'rgba(19, 18, 23, 0.7)' }}
          >
            <div className="flex items-center space-x-2">
              <img src={volumeIcon} alt="Звук" className="w-4 h-4" />
              <span className="text-white" style={{ fontWeight: 500, fontSize: '12px' }}>Звук</span>
            </div>
            <div
              className="relative w-[40px] h-[20px] rounded-full flex items-center p-0.5 cursor-pointer transition-colors duration-300"
              style={{ background: isSoundEnabled ? '#31EA3D' : '#2F2E35' }}
              onClick={toggleSound}
            >
              <div
                className="w-[16px] h-[16px] bg-white rounded-full transition-all duration-300"
                style={{ transform: isSoundEnabled ? 'translateX(20px)' : 'translateX(0)' }}
              ></div>
            </div>
          </div>

          {/* Exit Button */}
          <button
            onClick={handleExitClick}
            className="w-[225px] h-8 rounded-lg flex items-center justify-start px-3 space-x-2 transition-all duration-200 ease-in-out hover:opacity-80"
            style={{ backgroundColor: 'rgba(19, 18, 23, 0.7)' }}
          >
            <img src={exitIcon} alt="Выйти" className="w-4 h-4" />
            <span className="text-white" style={{ fontWeight: 500, fontSize: '12px' }}>Выйти</span>
          </button>
        </StyledContainer>
      </div>
      
      {showExitMenu && (
        <ExitMenu 
          onClose={handleExitCancel}
          onConfirm={handleExitConfirm}
        />
      )}
    </div>
  );
}
