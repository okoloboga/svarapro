import React from 'react';
import './EnterGameMenu.css';
import plusIcon from '@/assets/plus.png';
import lockIcon from '@/assets/lock.png';
import partyIcon from '@/assets/party.png';
import { useTranslation } from 'react-i18next';
import { Slider } from '../Slider';

interface EnterGameMenuProps {
  isOpen: boolean;
  onClose: () => void;
  openModal: (type: 'createPublic' | 'createPrivate' | 'connectRoom') => void;
}

const EnterGameMenu: React.FC<EnterGameMenuProps> = ({ isOpen, onClose, openModal }) => {
  const { t } = useTranslation('common');
  
  console.log('EnterGameMenu render - isOpen:', isOpen);

  return (
    <Slider isOpen={isOpen} onClose={onClose} height="250px">
      <div className="relative z-10 flex items-center justify-center h-full">
        <div
          className="modal-content bg-[#18171C] rounded-[15px]"
          style={{ width: '316px', height: '162px' }}
        >
          <button className="menu-button" onClick={() => openModal('createPublic')}>
            <img src={plusIcon} alt="Create" className="w-[26px] h-[26px]" />
            <span className="menu-button-text" style={{ marginLeft: '0px' }}>{t('create_room')}</span>
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
    </Slider>
  );
};

export default EnterGameMenu;