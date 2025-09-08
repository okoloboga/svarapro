import React from 'react';
import plusIcon from '@/assets/plus.png';
import lockIcon from '@/assets/lock.png';
import partyIcon from '@/assets/party.png';
import closeIcon from '@/assets/close.png';
import { useTranslation } from 'react-i18next';
import { EnterGameMenuProps } from '@/types/components';

const EnterGameMenu: React.FC<EnterGameMenuProps> = ({ onClose, openModal }) => {
  const { t } = useTranslation('common');

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end"
      onClick={onClose}
    >
      {/* Close Button - над компонентом */}
      <button 
        onClick={onClose}
        onTouchStart={(e) => e.preventDefault()}
        onTouchEnd={(e) => {
          e.preventDefault();
          onClose();
        }}
        className="absolute z-50"
        style={{ 
          top: 'calc(75vh - 40px)', 
          right: '20px',
          WebkitTapHighlightColor: 'transparent',
          touchAction: 'manipulation'
        }}
      >
        <img src={closeIcon} alt="Close" style={{ width: '19px', height: '19px' }} />
      </button>

      {/* Bottom Sheet Panel */}
      <div
        className="w-full transition-transform duration-300 ease-out translate-y-0"
        style={{ height: '25vh' }}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the panel
      >
        {/* EnterGameMenu Container - во всю ширину экрана */}
        <div
          className="relative w-full h-full flex flex-col justify-center"
          style={{
            background: 'linear-gradient(180deg, #48454D 0%, rgba(255, 255, 255, 0.3) 50%, #2D2B31 100%)',
            boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)',
            borderRadius: '20px 20px 0 0', // Скругление только сверху
          }}
        >
          {/* Inner background */}
          <div
            style={{
              position: 'absolute',
              inset: '1px',
              background: '#2E2B33',
              borderRadius: '19px 19px 0 0', // 20px - 1px
              zIndex: 0,
            }}
          />
          
          {/* Content */}
          <div className="relative z-10 flex flex-col items-center justify-center px-6">
            <button 
              className="w-full flex items-center justify-start py-3 px-4 mb-2"
              onClick={() => openModal('createPublic')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'white',
                borderRadius: '8px',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <img src={plusIcon} alt="Create" className="w-[26px] h-[26px] mr-3" />
              <span style={{ fontWeight: 600, fontSize: '15px', lineHeight: '150%', letterSpacing: '-0.011em' }}>
                {t('create_room')}
              </span>
            </button>
            
            <div 
              style={{ 
                width: '100%', 
                height: '1px', 
                backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                margin: '8px 0' 
              }} 
            />
            
            <button 
              className="w-full flex items-center justify-start py-3 px-4 mb-2"
              onClick={() => openModal('createPrivate')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'white',
                borderRadius: '8px',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <img src={lockIcon} alt="Create Private" className="w-[26px] h-[26px] mr-3" />
              <span style={{ fontWeight: 600, fontSize: '15px', lineHeight: '150%', letterSpacing: '-0.011em' }}>
                {t('create_private_room')}
              </span>
            </button>
            
            <div 
              style={{ 
                width: '100%', 
                height: '1px', 
                backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                margin: '8px 0' 
              }} 
            />
            
            <button 
              className="w-full flex items-center justify-start py-3 px-4"
              onClick={() => openModal('connectRoom')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'white',
                borderRadius: '8px',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <img src={partyIcon} alt="Join" className="w-[26px] h-[26px] mr-3" />
              <span style={{ fontWeight: 600, fontSize: '15px', lineHeight: '150%', letterSpacing: '-0.011em' }}>
                {t('join_room')}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnterGameMenu;
