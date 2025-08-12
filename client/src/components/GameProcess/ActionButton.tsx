
import passIcon from '../../assets/game/pass.svg';
import lookIcon from '../../assets/game/look.svg';
import raiseIcon from '../../assets/game/raise.svg';

interface ActionButtonsProps {
  canFold: boolean;
  canCall: boolean;
  canRaise: boolean;
  canLook: boolean;
  callAmount: number;
  onFold: () => void;
  onCall: () => void;
  onRaise: () => void;
  onLook: () => void;
}

export function ActionButtons({
  canFold,
  canCall,
  canRaise,
  canLook,
  callAmount,
  onFold,
  onCall,
  onRaise,
  onLook,
}: ActionButtonsProps) {
  return (
    <div className="flex items-center justify-center space-x-2 p-2">
      {canFold && (
        <button
          onClick={onFold}
          className="flex flex-col items-center justify-center w-20 h-16 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
        >
          <img src={passIcon} alt="" className="w-6 h-6 mb-1" />
          <span>Пас</span>
        </button>
      )}
      
      {canCall && (
        <button
          onClick={onCall}
          className="flex flex-col items-center justify-center w-20 h-16 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <span>Заплатить {callAmount > 0 ? `${callAmount}` : ''}</span>
        </button>
      )}

      {canRaise && (
        <button
          onClick={onRaise}
          className="flex flex-col items-center justify-center w-20 h-16 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
        >
          <img src={raiseIcon} alt="" className="w-6 h-6 mb-1" />
          <span>Повысить</span>
        </button>
      )}
      
      {canLook && (
        <button
          onClick={onLook}
          className="flex flex-col items-center justify-center w-20 h-16 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
        >
          <img src={lookIcon} alt="" className="w-6 h-6 mb-1" />
          <span>Открыть</span>
        </button>
      )}
    </div>
  );
}
