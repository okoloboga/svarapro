import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import lockIcon from '../../assets/lock.png';
import incompleteIcon from '../../assets/completeSmallGrey.png';
import completeIcon from '../../assets/completeSmallGreen.png';

type ConnectRoomProps = {
  onClose: () => void;
  openModal: () => void;
};

export const ConnectRoom: React.FC<ConnectRoomProps> = ({ onClose, openModal }) => {
  const { t } = useTranslation('common');
  const [inputValue, setInputValue] = useState('');
  const [isValid, setIsValid] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^[a-zA-Z0-9]*$/.test(value)) {
      setInputValue(value);
      setIsValid(value.length >= 6);
    }
  };

  const handleCancel = () => {
    onClose();
    openModal();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#18171C] w-[316px] h-[200px] rounded-lg flex flex-col items-center py-4 px-4 relative">
        <h2 className="text-white font-semibold text-lg mb-4">{t('join_room')}</h2>
        <div className="relative w-full mb-4">
          <img src={lockIcon} alt="lock" className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6" />
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder={t('room_number')}
            className="bg-[#13121780] text-[#808797] text-center text-xs font-normal w-full h-12 rounded-lg pl-10 pr-10"
          />
          <img src={isValid ? completeIcon : incompleteIcon} alt="complete" className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6" />
        </div>
        <div className="absolute bottom-0 left-0 w-full flex">
          <button 
            className="w-[164px] h-[49px] text-[#5F8BE7] border-t border-r border-white border-opacity-10"
            onClick={() => { /* Handle Join */ }}
          >
            {t('enter')}
          </button>
          <button 
            className="w-[164px] h-[49px] text-[#5F8BE7] border-t border-white border-opacity-10"
            onClick={handleCancel}
          >
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};
