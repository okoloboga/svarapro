import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import dollarIcon from '@/assets/dollar.png';
import incompleteIcon from '@/assets/completeSmallGrey.png';
import completeIcon from '@/assets/completeSmallGreen.png';
import { apiService } from '@/services/api/api';
import { CreatePublicProps } from '@/types/components';

export const CreatePublic: React.FC<CreatePublicProps> = ({ onClose, openModal, setCurrentPage }) => {
  const { t } = useTranslation('common');
  const [inputValue, setInputValue] = useState('');
  const [isValid, setIsValid] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*\.?\d*$/.test(value)) {
      setInputValue(value);
      const numValue = parseFloat(value);
      setIsValid(!isNaN(numValue) && numValue > 0);
    }
  };

  const handleCreate = async () => {
    if (!isValid) return;
    setIsCreating(true);
    try {
      const bet = parseFloat(inputValue);
      const room = await apiService.createRoom(bet, 'public');
      onClose();
      setCurrentPage('gameRoom', { roomId: room.roomId, autoSit: true });
    } catch (error) {
      console.error('Failed to create room:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    onClose();
    openModal();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#47444C] w-[316px] h-[200px] rounded-lg flex flex-col items-center py-4 px-4 relative">
        <h2 className="text-white font-semibold text-lg mb-4">{t('create_room')}</h2>
        <div className="relative w-full mb-4">
          <img src={dollarIcon} alt="dollar" className="absolute left-3 top-1/2 -translate-y-1/2 w-[11px] h-[17px]" />
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder={t('min_stake')}
            className="bg-[#13121780] text-[#808797] text-center text-xs font-normal w-full h-12 rounded-lg pl-10 pr-10"
          />
          <img src={isValid ? completeIcon : incompleteIcon} alt="complete" className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6" />
        </div>
        <div className="absolute bottom-0 left-0 w-full flex">
          <button 
            className="w-[164px] h-[49px] text-[#5F8BE7] border-t border-r border-white border-opacity-10"
            onClick={handleCreate}
            disabled={isCreating || !isValid}
          >
            {t('create')}
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
