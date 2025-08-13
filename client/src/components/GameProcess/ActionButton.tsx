interface ActionButtonsProps {
  canFold: boolean;
  canCall: boolean;
  canRaise: boolean;
  canLook: boolean;
  canBlindBet: boolean;
  callAmount: number;
  onFold: () => void;
  onCall: () => void;
  onRaise: () => void;
  onLook: () => void;
  onBlindBet: () => void;
  disabled?: boolean;
}

export function ActionButtons({
  canFold,
  canCall,
  canRaise,
  canLook,
  canBlindBet,
  callAmount,
  onFold,
  onCall,
  onRaise,
  onLook,
  onBlindBet,
  disabled,
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
          className={`flex items-center justify-center w-[95px] h-[42px] text-white rounded-lg transition ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          style={{ backgroundColor: '#0E5C89' }}
          disabled={disabled}
        >
          <span>Открыть</span>
        </button>
      )}

      {canBlindBet && (
        <button
          onClick={onBlindBet}
          className={`flex items-center justify-center w-[95px] h-[42px] text-white rounded-lg transition ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          style={{ backgroundColor: '#0E5C89' }}
          disabled={disabled}
        >
          <span>Вслепую</span>
        </button>
      )}
    </div>
  );
}