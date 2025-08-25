import React from 'react';
import closeIcon from '@/assets/close.png';
import chatButtonBg from '@/assets/game/chat.png';
import { useTranslation } from 'react-i18next';

interface ChatMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPhrase: (phrase: string) => void;
}

export function ChatMenu({ isOpen, onClose, onSelectPhrase }: ChatMenuProps) {
  const { t } = useTranslation('common');

  const chatPhrases = [
    t('chat.phrase1'), t('chat.phrase2'), t('chat.phrase3'), t('chat.phrase4'),
    t('chat.phrase5'), t('chat.phrase6'), t('chat.phrase7'), t('chat.phrase8'),
    t('chat.phrase9'), t('chat.phrase10'), t('chat.phrase11'), t('chat.phrase12'),
    t('chat.phrase13'), t('chat.phrase14'), t('chat.phrase15'), t('chat.phrase16'),
    t('chat.phrase17'), t('chat.phrase18'), t('chat.phrase19'), t('chat.phrase20'),
  ];

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
                    ...buttonTextStyle,
                    paddingBottom: '13px' // Поднимаем текст на 5px выше
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