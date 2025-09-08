import React from 'react';
import { ExitMenuProps } from '@/types/components';
import { useTranslation } from 'react-i18next';

export const ExitMenu: React.FC<ExitMenuProps> = ({ onClose, onConfirm }) => {
  const { t } = useTranslation('common');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#47444C] w-[316px] h-[172px] rounded-lg flex flex-col items-center py-4 px-4 relative">
        <h2 className="text-white font-semibold text-lg mb-4">{t('confirmation')}</h2>
        
        <div className="flex-1 flex items-center justify-center text-center">
          <p className="text-white text-sm leading-relaxed">
            {t('exit_confirmation_text')}
          </p>
        </div>
        
        <div className="absolute bottom-0 left-0 w-full flex">
          <button 
            className="w-[164px] h-[49px] text-[#5F8BE7] border-t border-r border-white border-opacity-10 hover:bg-white hover:bg-opacity-5 transition-colors duration-200"
            onClick={onConfirm}
          >
            {t('yes')}
          </button>
          <button 
            className="w-[164px] h-[49px] text-[#5F8BE7] border-t border-white border-opacity-10 hover:bg-white hover:bg-opacity-5 transition-colors duration-200"
            onClick={onClose}
          >
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};