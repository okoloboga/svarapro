import lookIcon from '../../assets/game/look.svg';
import passIcon from '../../assets/game/pass.svg';
import raiseIcon from '../../assets/game/raise.svg';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';

const formatAmount = (amount: number): string => {
  const num = Number(amount);
  const fixed = num.toFixed(2);
  if (fixed.endsWith('.00')) {
    return String(Math.round(num));
  }
  if (fixed.endsWith('0')) {
    return fixed.slice(0, -1);
  }
  return fixed;
};

interface ActionButtonsProps {
  canFold: boolean;
  canCall: boolean;
  canRaise: boolean;
  canLook: boolean;
  canBlindBet: boolean;
  canAllIn: boolean;
  callAmount: number;
  minBet: number;
  turnTimer: number;
  onFold: () => void;
  onCall: () => void;
  onRaise: () => void;
  onLook: () => void;
  onBlindBet: () => void;
  onAllIn: () => void;
  blindButtonsDisabled?: boolean;
  isCallDisabled?: boolean;
  isRaiseDisabled?: boolean;
  isBlindBetDisabled?: boolean;
  postLookActions?: boolean; // Новый флаг для отображения кнопок после просмотра
}

export function ActionButtons({
  canFold,
  canCall,
  canRaise,
  canLook,
  canBlindBet,
  canAllIn,
  callAmount,
  minBet,
  turnTimer,
  onFold,
  onCall,
  onRaise,
  onLook,
  onBlindBet,
  onAllIn,
  blindButtonsDisabled,
  isCallDisabled,
  isRaiseDisabled,
  isBlindBetDisabled,
  postLookActions,
}: ActionButtonsProps) {
  const { t } = useTranslation('common');
  
  // Состояния для анимации нажатия каждой кнопки
  const [isPressed, setIsPressed] = useState({
    fold: false,
    call: false,
    raise: false,
    look: false,
    blindBet: false,
    allIn: false,
  });

  const handleButtonPress = (buttonType: keyof typeof isPressed, callback: () => void) => {
    console.log('🎯 Button press:', buttonType, 'isPressed:', isPressed[buttonType]);
    setIsPressed(prev => ({ ...prev, [buttonType]: true }));
    setTimeout(() => {
      setIsPressed(prev => ({ ...prev, [buttonType]: false }));
    }, 300);
    // Задержка перед вызовом callback, чтобы анимация успела показаться
    setTimeout(() => {
      callback();
    }, 100);
  };

  if (postLookActions) {
    // Если игрок посмотрел карты, показываем Fold, Call и Raise
    return (
      <div className="flex flex-col items-center justify-center -mt-[10px]">
        <div className="relative flex items-center justify-center space-x-2 p-2">
          {/* Fold Button */}
          <div className="relative">
            <button
              onClick={() => handleButtonPress('fold', onFold)}
              className={`flex flex-col items-center justify-center w-[95px] h-[42px] text-white rounded-lg  ${isPressed.fold ? 'button-press' : ''}`}
              style={{ backgroundColor: '#FF443A' }}
            >
              <img src={passIcon} alt={t('pass')} style={{ width: '16px', height: '16px' }} />
              <span className="-mt-1">{t('pass')}</span>
            </button>
            <div 
              className="absolute text-white w-full text-center"
              style={{
                fontWeight: 500,
                fontSize: '12px',
                lineHeight: '100%',
                bottom: '-15px',
                left: '50%',
                transform: 'translateX(-50%)',
              }}
            >
              ({turnTimer}) {t('sec')}
            </div>
          </div>

          {canAllIn ? (
            <button
                onClick={() => handleButtonPress('allIn', onAllIn)}
                className={`flex flex-col items-center justify-center w-[95px] h-[42px] text-white rounded-lg  ${isPressed.allIn ? 'button-press' : ''}`}
                style={{ backgroundColor: '#0E5C89' }}
            >
                <span>${formatAmount(callAmount)}</span>
                <span className="-mt-1">{t('all_in')}</span>
            </button>
          ) : (
            <>
              {/* Call Button */}
              <button
                onClick={() => handleButtonPress('call', onCall)}
                className={`flex flex-col items-center justify-center w-[95px] h-[42px] text-white rounded-lg  ${
                  isCallDisabled ? 'opacity-50 cursor-not-allowed' : ''
                } ${isPressed.call ? 'button-press' : ''}`}
                style={{ backgroundColor: '#0E5C89' }}
                disabled={isCallDisabled}
              >
                <span>${formatAmount(callAmount)}</span>
                <span className="-mt-1">{t('pay')}</span>
              </button>

              {/* Raise Button */}
              <button
                onClick={() => handleButtonPress('raise', onRaise)}
                className={`flex flex-col items-center justify-center w-[95px] h-[42px] text-white rounded-lg  ${
                  isRaiseDisabled ? 'opacity-50 cursor-not-allowed' : ''
                } ${isPressed.raise ? 'button-press' : ''}`}
                style={{ backgroundColor: '#56BF00' }}
                disabled={isRaiseDisabled}
              >
                <img src={raiseIcon} alt={t('raise')} style={{ width: '19px', height: '14px' }} />
                <span className="-mt-1">{t('raise')}</span>
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center -mt-[10px]">
      <div className="relative flex items-center justify-center space-x-2 p-2">
        {canFold && (
          <div className="relative">
            <button
              onClick={() => handleButtonPress('fold', onFold)}
              className={`flex flex-col items-center justify-center w-[95px] h-[42px] text-white rounded-lg  ${isPressed.fold ? 'button-press' : ''}`}
              style={{ backgroundColor: '#FF443A' }}
            >
              <img src={passIcon} alt={t('pass')} style={{ width: '16px', height: '16px' }} />
              <span className="-mt-1">{t('pass')}</span>
            </button>
            <div 
              className="absolute text-white w-full text-center"
              style={{
                fontWeight: 500,
                fontSize: '12px',
                lineHeight: '100%',
                bottom: '-15px',
                left: '50%',
                transform: 'translateX(-50%)',
              }}
            >
              ({turnTimer}) {t('sec')}
            </div>
          </div>
        )}
        
        {canCall && (
          <button
            onClick={() => handleButtonPress('call', onCall)}
            className={`flex flex-col items-center justify-center w-[95px] h-[42px] text-white rounded-lg  ${
              isCallDisabled ? 'opacity-50 cursor-not-allowed' : ''
            } ${isPressed.call ? 'button-press' : ''}`}
            style={{ backgroundColor: '#0E5C89' }}
            disabled={isCallDisabled}
          >
            <span>${formatAmount(callAmount)}</span>
            <span className="-mt-1">{t('pay')}</span>
          </button>
        )}

        {canRaise && (
          <button
            onClick={() => handleButtonPress('raise', onRaise)}
            className={`flex flex-col items-center justify-center w-[95px] h-[42px] text-white rounded-lg  ${
              isRaiseDisabled ? 'opacity-50 cursor-not-allowed' : ''
            } ${isPressed.raise ? 'button-press' : ''}`}
            style={{ backgroundColor: '#56BF00' }}
            disabled={isRaiseDisabled}
          >
            <img src={raiseIcon} alt={t('raise')} style={{ width: '19px', height: '14px' }} />
            <span className="-mt-1">{t('raise')}</span>
          </button>
        )}

        {canAllIn && (
            <button
                onClick={() => handleButtonPress('allIn', onAllIn)}
                className={`flex flex-col items-center justify-center w-[95px] h-[42px] text-white rounded-lg  ${isPressed.allIn ? 'button-press' : ''}`}
                style={{ backgroundColor: '#0E5C89' }}
            >
                <span>${formatAmount(callAmount)}</span>
                <span className="-mt-1">{t('all_in')}</span>
            </button>
        )}
        
        {canLook && (
          <button
            onClick={() => handleButtonPress('look', onLook)}
            className={`flex flex-col items-center justify-center w-[95px] h-[42px] text-white rounded-lg  ${
              blindButtonsDisabled ? 'opacity-50 cursor-not-allowed' : ''
            } ${isPressed.look ? 'button-press' : ''}`}
            style={{ backgroundColor: '#0E5C89' }}
            disabled={blindButtonsDisabled}
          >
            <img src={lookIcon} alt={t('open')} style={{ width: '42px', height: '13px' }} />
            <span className="-mt-1">{t('open')}</span>
          </button>
        )}

        {canBlindBet && !canAllIn && (
          <button
            onClick={() => handleButtonPress('blindBet', onBlindBet)}
            className={`flex flex-col items-center justify-center w-[95px] h-[42px] text-white rounded-lg  ${
              blindButtonsDisabled || isBlindBetDisabled ? 'opacity-50 cursor-not-allowed' : ''
            } ${isPressed.blindBet ? 'button-press' : ''}`}
            style={{ backgroundColor: '#0E5C89' }}
            disabled={blindButtonsDisabled || isBlindBetDisabled}
          >
            <span>${formatAmount(minBet)}</span>
            <span className="-mt-1">{t('blind')}</span>
          </button>
        )}
        
      </div>
    </div>
  );
}