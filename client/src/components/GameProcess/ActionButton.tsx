import lookIcon from '../../assets/game/look.svg';

interface ActionButtonsProps {
  canFold: boolean;
  canCall: boolean;
  canRaise: boolean;
  canLook: boolean;
  canBlindBet: boolean;
  callAmount: number;
  minBet: number;
  onFold: () => void;
  onCall: () => void;
  onRaise: () => void;
  onLook: () => void;
  onBlindBet: () => void;
  blindButtonsDisabled?: boolean;
}

export function ActionButtons({
  canFold,
  canCall,
  canRaise,
  canLook,
  canBlindBet,
  callAmount,
  minBet,
  onFold,
  onCall,
  onRaise,
  onLook,
  onBlindBet,
  blindButtonsDisabled,
}: ActionButtonsProps) {
  return (
    <div className="flex items-center justify-center space-x-2 p-2">
      {canFold && (
        <button
          onClick={onFold}
          className="flex items-center justify-center w-[95px] h-[42px] text-white rounded-lg transition"
          style={{ backgroundColor: '#FF443A' }}
        >
          <span>Пас</span>
        </button>
      )}
      
      {canCall && (
        <button
          onClick={onCall}
          className="flex items-center justify-center w-[95px] h-[42px] text-white rounded-lg transition"
          style={{ backgroundColor: '#0E5C89' }}
        >
          <span>Заплатить {callAmount > 0 ? `${callAmount}` : ''}</span>
        </button>
      )}

      {canRaise && (
        <button
          onClick={onRaise}
          className="flex items-center justify-center w-[95px] h-[42px] text-white rounded-lg transition"
          style={{ backgroundColor: '#56BF00' }}
        >
          <span>Повысить</span>
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
          <img src={lookIcon} alt="" className="w-6 h-6" />
          <span>Открыть</span>
        </button>
      )}

      {canBlindBet && (
        <button
          onClick={onBlindBet}
          className={`flex flex-col items-center justify-center w-[95px] h-[42px] text-white rounded-lg transition ${
            blindButtonsDisabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          style={{ backgroundColor: '#0E5C89' }}
          disabled={blindButtonsDisabled}
        >
          <span>${minBet}</span>
          <span>Вслепую</span>
        </button>
      )}
    </div>
  );
}