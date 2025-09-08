import React from 'react';
import './EnterGameMenu.css';
import plusIcon from '@/assets/plus.png';
import lockIcon from '@/assets/lock.png';
import partyIcon from '@/assets/party.png';
import closeIcon from '@/assets/close.png';
import { useTranslation } from 'react-i18next';
import { EnterGameMenuProps } from '@/types/components';

const EnterGameMenu: React.FC<EnterGameMenuProps> = ({ onClose, openModal }) => {
  const { t } = useTranslation('common');

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

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
          className="relative w-full h-full flex items-center justify-center"
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
          
          {/* Original EnterGameMenu content */}
          <div className="relative z-10" onClick={handleOverlayClick}>
            <div
              className="modal-content bg-[#18171C] rounded-[15px] animate-slide-up"
              style={{ width: '316px', height: '162px' }}
            >
              <button className="menu-button" onClick={() => openModal('createPublic')}>
                <img src={plusIcon} alt="Create" className="w-[26px] h-[26px]" />
                <span className="menu-button-text">{t('create_room')}</span>
              </button>
              <div className="divider"></div>
              <button className="menu-button" onClick={() => openModal('createPrivate')}>
                <img src={lockIcon} alt="Create Private" className="w-[26px] h-[26px]" />
                <span className="menu-button-text">{t('create_private_room')}</span>
              </button>
              <div className="divider"></div>
              <button className="menu-button" onClick={() => openModal('connectRoom')}>
                <img src={partyIcon} alt="Join" className="w-[26px] h-[26px]" />
                <span className="menu-button-text">{t('join_room')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnterGameMenu;
