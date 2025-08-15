import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import lockIcon from '@/assets/lock.png';
import dollarIcon from '@/assets/dollar.png';
import incompleteIcon from '@/assets/completeSmallGrey.png';
import completeIcon from '@/assets/completeSmallGreen.png';
import { apiService } from '@/services/api/api';
import { CreatePrivateProps } from '@/types/components';

export const CreatePrivate: React.FC<CreatePrivateProps> = ({ onClose, openModal, setCurrentPage, balance }) => {
  const { t } = useTranslation('common');
  const [password, setPassword] = useState('');
  const [stake, setStake] = useState('');
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const [isStakeValid, setIsStakeValid] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*$/.test(value)) {
      setPassword(value);
      setIsPasswordValid(value.length >= 6);
    }
  };

  const handleStakeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*\.?\d*$/.test(value)) {
      setStake(value);
      const numValue = parseFloat(value);
      const userBalance = parseFloat(balance);
      const isValidInput = !isNaN(numValue) && numValue > 0;
      setIsStakeValid(isValidInput);

      if (isValidInput && userBalance < numValue * 3) {
        setBalanceError(t('not_enough_balance_for_stake'));
      } else {
        setBalanceError(null);
      }
    }
  };

  const handleCreate = async () => {
    if (!isPasswordValid || !isStakeValid || balanceError) return;
    setIsCreating(true);
    setError(null);
    try {
      const bet = parseFloat(stake);
      const room = await apiService.createRoom(bet, 'private', password);
      onClose();
      setCurrentPage('gameRoom', { roomId: room.roomId, autoSit: true });
    } catch (error: unknown) {
      setError((error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to create room');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    onClose();
    openModal();
  };

  const isFormValid = isPasswordValid && isStakeValid && !balanceError;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#47444C] w-[316px] h-[280px] rounded-lg flex flex-col items-center py-4 px-4 relative">
        <h2 className="text-white font-semibold text-lg mb-4">{t('create_private_room')}</h2>
        {error && (
          <p className="text-red-500 text-sm mb-2">{error}</p>
        )}
        {balanceError && <p className="text-red-500 text-xs mb-2">{balanceError}</p>}
        <div className="relative w-full mb-4">
          <img src={lockIcon} alt="lock" className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6" />
          <input
            type="text"
            value={password}
            onChange={handlePasswordChange}
            placeholder={t('come_up_with_a_password')}
            className="bg-[#13121780] text-[#808797] text-center text-xs font-normal w-full h-12 rounded-lg pl-10 pr-10"
          />
          <img src={isPasswordValid ? completeIcon : incompleteIcon} alt="complete" className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6" />
        </div>
        <div className="relative w-full mb-4">
          <img src={dollarIcon} alt="dollar" className="absolute left-3 top-1/2 -translate-y-1/2 w-[11px] h-[17px]" />
          <input
            type="text"
            value={stake}
            onChange={handleStakeChange}
            placeholder={t('min_stake')}
            className="bg-[#13121780] text-[#808797] text-center text-xs font-normal w-full h-12 rounded-lg pl-10 pr-10"
          />
          <img src={isStakeValid ? completeIcon : incompleteIcon} alt="complete" className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6" />
        </div>
        <div className="absolute bottom-0 left-0 w-full flex">
          <button 
            className="w-[164px] h-[49px] text-[#5F8BE7] border-t border-r border-white border-opacity-10 disabled:opacity-50"
            onClick={handleCreate}
            disabled={!isFormValid || isCreating}
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
