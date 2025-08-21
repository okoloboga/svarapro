import React from 'react';
import closeIcon from '@/assets/close.png';
import chatButtonBg from '@/assets/game/chat.png';

interface ChatMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPhrase: (phrase: string) => void;
}

const chatPhrases = [
  "Здарова Бандюганы!", "Ха-Ха-Ха!", "Спасибо!", "Давай-Давай!",
  "Респект!", "Вау!", "Не бойся, дерзай!", "Удачи!",
  "Ништяк!", "Вот это да!", "А мне по барабану!", "Хорошая игра",
  "Не везет!", "Супер!", "Извини!", "Чую блеф!",
  "Быстрее!", "Ля какой хитрый!", "Блин!", "Ва-банк!",
];

export function ChatMenu({ isOpen, onClose, onSelectPhrase }: ChatMenuProps) {
  if (!isOpen) {
    return null;
  }

  const buttonTextStyle: React.CSSProperties = {
    fontWeight: 700,
    fontSize: '9px',
    lineHeight: '100%',
    textAlign: 'center',
    color: 'black',
    textShadow: '0px 0.5px 1px rgba(255, 255, 255, 0.5)', // Lighter shadow for dark text
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end"
      onClick={onClose}
    >
      {/* Close Button - positioned relative to the viewport */}
      <button 
        onClick={onClose} 
        className="absolute z-50"
        style={{ 
          bottom: '327px', // 317px height + 10px margin
          right: '20px',
        }}
      >
        <img src={closeIcon} alt="Close" style={{ width: '19px', height: '19px' }} />
      </button>

      {/* Bottom Sheet Panel */}
      <div
        className={`w-full transition-transform duration-300 ease-out ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ height: '317px' }}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the panel
      >
        {/* Container with specified styles */}
        <div
          className="relative w-full h-full"
          style={{
            background: 'linear-gradient(180deg, #48454D 0%, rgba(255, 255, 255, 0.3) 50%, #2D2B31 100%)',
            boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)',
            borderRadius: '32px 32px 0 0', // Скругление только сверху
          }}
        >
          {/* Inner background */}
          <div
            style={{
              position: 'absolute',
              inset: '1px',
              background: '#2E2B33',
              borderRadius: '31px', // 32px - 1px
              zIndex: 0,
            }}
          />
          
          {/* Content Grid */}
          <div className="relative z-10 p-4 h-full flex items-center justify-center">
            <div className="grid grid-cols-4 gap-x-2 gap-y-3">
              {chatPhrases.map((phrase, index) => (
                <button 
                  key={index}
                  onClick={() => onSelectPhrase(phrase)}
                  className="flex items-center justify-center p-1"
                  style={{
                    width: '75px',
                    height: '38px',
                    backgroundImage: `url(${chatButtonBg})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    ...buttonTextStyle
                  }}
                >
                  {phrase}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
