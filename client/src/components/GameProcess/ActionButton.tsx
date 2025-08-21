import lookIcon from '../../assets/game/look.svg';
import passIcon from '../../assets/game/pass.svg';
import raiseIcon from '../../assets/game/raise.svg';

interface ActionButtonsProps {
  canFold: boolean;
  canCall: boolean;
  canRaise: boolean;
  canLook: boolean;
  canBlindBet: boolean;
  callAmount: number;
  minBet: number;
  turnTimer: number;
  onFold: () => void;
  onCall: () => void;
  onRaise: () => void;
  onLook: () => void;
  onBlindBet: () => void;
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
  callAmount,
  minBet,
  turnTimer,
  onFold,
  onCall,
  onRaise,
  onLook,
  onBlindBet,
  blindButtonsDisabled,
  isCallDisabled,
  isRaiseDisabled,
  isBlindBetDisabled,
  postLookActions,
}: ActionButtonsProps) {
  if (postLookActions) {
    // Если игрок посмотрел карты, показываем Fold, Call и Raise
    return (
      <div className="flex flex-col items-center justify-center">
        <div className="relative flex items-center justify-center space-x-2 p-2">
          {/* Fold Button */}
          <div className="relative">
            <button
              onClick={onFold}
              className="flex flex-col items-center justify-center w-[95px] h-[42px] text-white rounded-lg transition"
              style={{ backgroundColor: '#FF443A' }}
            >
              <img src={passIcon} alt="Пас" style={{ width: '16px', height: '16px' }} />
              <span className="-mt-1">Пас</span>
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
              ({turnTimer}) сек
            </div>
          </div>
          {/* Call Button */}
          <button
            onClick={onCall}
            className={`flex flex-col items-center justify-center w-[95px] h-[42px] text-white rounded-lg transition ${
              isCallDisabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            style={{ backgroundColor: '#0E5C89' }}
            disabled={isCallDisabled}
          >
            <span>${Number(callAmount).toFixed(2)}</span>
            <span className="-mt-1">Ответить</span>
          </button>
          {/* Raise Button */}
          <button
            onClick={onRaise}
            className={`flex flex-col items-center justify-center w-[95px] h-[42px] text-white rounded-lg transition ${
              isRaiseDisabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            style={{ backgroundColor: '#56BF00' }}
            disabled={isRaiseDisabled}
          >
            <img src={raiseIcon} alt="Повысить" style={{ width: '19px', height: '14px' }} />
            <span className="-mt-1">Повысить</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative flex items-center justify-center space-x-2 p-2">
        {canFold && (
          <div className="relative">
            <button
              onClick={onFold}
              className="flex flex-col items-center justify-center w-[95px] h-[42px] text-white rounded-lg transition"
              style={{ backgroundColor: '#FF443A' }}
            >
              <img src={passIcon} alt="Пас" style={{ width: '16px', height: '16px' }} />
              <span className="-mt-1">Пас</span>
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
              ({turnTimer}) сек
            </div>
          </div>
        )}
        
        {canCall && (
          <button
            onClick={onCall}
            className={`flex flex-col items-center justify-center w-[95px] h-[42px] text-white rounded-lg transition ${
              isCallDisabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            style={{ backgroundColor: '#0E5C89' }}
            disabled={isCallDisabled}
          >
            <span>${Number(callAmount).toFixed(2)}</span>
            <span className="-mt-1">Заплатить</span>
          </button>
        )}

        {canRaise && (
          <button
            onClick={onRaise}
            className={`flex flex-col items-center justify-center w-[95px] h-[42px] text-white rounded-lg transition ${
              isRaiseDisabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            style={{ backgroundColor: '#56BF00' }}
            disabled={isRaiseDisabled}
          >
            <img src={raiseIcon} alt="Повысить" style={{ width: '19px', height: '14px' }} />
            <span className="-mt-1">Повысить</span>
          </button>
        )}
        
        {canLook && (
          <button
            onClick={onLook}
            className={`flex flex-col items-center justify-center w-[95px] h-[42px] text-white rounded-lg transition ${
              blindButtonsDisabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            style={{ backgroundColor: '#0E5C89' }}
            disabled={blindButtonsDisabled}
          >
            <img src={lookIcon} alt="Открыть" style={{ width: '42px', height: '13px' }} />
            <span className="-mt-1">Открыть</span>
          </button>
        )}

        {canBlindBet && (
          <button
            onClick={onBlindBet}
            className={`flex flex-col items-center justify-center w-[95px] h-[42px] text-white rounded-lg transition ${
              blindButtonsDisabled || isBlindBetDisabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            style={{ backgroundColor: '#0E5C89' }}
            disabled={blindButtonsDisabled || isBlindBetDisabled}
          >
            <span>${Number(minBet).toFixed(2)}</span>
            <span className="-mt-1">Вслепую</span>
          </button>
        )}
        
      </div>
    </div>
  );
}