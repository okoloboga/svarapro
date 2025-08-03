import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import lockIcon from '../../assets/lock.png';
import dollarIcon from '../../assets/dollar.png';
import incompleteIcon from '../../assets/completeSmallGrey.png';
import completeIcon from '../../assets/completeSmallGreen.png';

type CreatePrivateProps = {
  onClose: () => void;
  openModal: (modal: 'enterGameMenu') => void;
};

export const CreatePrivate: React.FC<CreatePrivateProps> = ({ onClose, openModal }) => {
  const { t } = useTranslation('common');
  const [password, setPassword] = useState('');
  const [stake, setStake] = useState('');
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const [isStakeValid, setIsStakeValid] = useState(false);

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^[a-zA-Z0-9]*$/.test(value)) {
      setPassword(value);
      setIsPasswordValid(value.length >= 6);
    }
  };

  const handleStakeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*\.?\d*$/.test(value)) {
      setStake(value);
      setIsStakeValid(!!value);
    }
  };

  const handleCancel = () => {
    onClose();
    openModal('enterGameMenu');
  };

  const isFormValid = isPasswordValid && isStakeValid;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#18171C] w-[316px] h-[260px] rounded-lg flex flex-col items-center py-4 px-4 relative">
        <h2 className="text-white font-semibold text-lg mb-4">{t('create_private_room')}</h2>
        <div className="relative w-full mb-4">
          <img src={lockIcon} alt="lock" className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6" />
          <input
            type="text"
            value={password}
            onChange={handlePasswordChange}
            placeholder={t('password')}
            className="bg-[#13121780] text-[#808797] text-center text-xs font-normal w-full h-12 rounded-lg pl-10 pr-10"
          />
          <img src={isPasswordValid ? completeIcon : incompleteIcon} alt="complete" className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6" />
        </div>
        <div className="relative w-full mb-4">
          <img src={dollarIcon} alt="dollar" className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6" />
          <input
            type="text"
            value={stake}
            onChange={handleStakeChange}
            placeholder={t('stake')}
            className="bg-[#13121780] text-[#808797] text-center text-xs font-normal w-full h-12 rounded-lg pl-10 pr-10"
          />
          <img src={isStakeValid ? completeIcon : incompleteIcon} alt="complete" className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6" />
        </div>
        <div className="absolute bottom-0 left-0 w-full flex">
          <button 
            className="w-[164px] h-[49px] text-[#5F8BE7] border-t border-r border-white border-opacity-10 disabled:opacity-50"
            onClick={() => { /* Handle Create */ }}
            disabled={!isFormValid}
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
