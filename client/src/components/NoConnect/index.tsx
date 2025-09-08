import React from 'react';
import { useTranslation } from 'react-i18next';
import noconnectIcon from '../../assets/noconnect.png';

interface NoConnectProps {
  isVisible: boolean;
  onRetry?: () => void;
}

export function NoConnect({ isVisible, onRetry }: NoConnectProps) {
  const { t } = useTranslation('common');

  if (!isVisible) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end"
      onClick={onRetry}
    >
      {/* Bottom Sheet Panel */}
      <div
        className={`w-full transition-transform duration-300 ease-out ${isVisible ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ height: '25vh' }}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the panel
      >
        {/* NoConnect Container - во всю ширину экрана */}
        <div
          className="relative w-full h-full flex flex-col items-center justify-center"
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
              background: 'linear-gradient(180deg, #48454D 0%, rgba(255, 255, 255, 0.3) 50%, #2D2B31 100%)',
              borderRadius: '19px 19px 0 0',
            }}
          />
          
          {/* Content */}
          <div className="relative z-10 flex flex-col items-center justify-center text-center px-6">
            {/* Иконка */}
            <img 
              src={noconnectIcon} 
              alt="No connection" 
              style={{ width: '69px', height: '69px', marginBottom: '16px' }}
            />
            
            {/* Заголовок */}
            <h3 
              className="text-white mb-2"
              style={{
                fontWeight: 700,
                fontStyle: 'normal',
                fontSize: '16px',
                lineHeight: '150%',
                letterSpacing: '-1.1%',
                textAlign: 'center',
                verticalAlign: 'middle'
              }}
            >
              {t('no_internet_connection')}
            </h3>
            
            {/* Описание */}
            <p 
              className="text-white"
              style={{
                fontWeight: 600,
                fontStyle: 'normal',
                fontSize: '13px',
                lineHeight: '150%',
                letterSpacing: '-1.1%',
                textAlign: 'center',
                verticalAlign: 'middle'
              }}
            >
              {t('check_internet_connection')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}