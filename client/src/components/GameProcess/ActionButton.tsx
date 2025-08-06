import React from 'react';

interface ActionButtonsProps {
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  canRaise: boolean;
  canLook: boolean;
  callAmount: number;
  onFold: () => void;
  onCheck: () => void;
  onCall: () => void;
  onRaise: (amount: number) => void;
  onLook: () => void;
  currentBet: number;
  minRaise: number;
  maxRaise: number;
}

export function ActionButtons({
  canFold,
  canCheck,
  canCall,
  canRaise,
  canLook,
  callAmount,
  onFold,
  onCheck,
  onCall,
  onRaise,
  onLook,
  minRaise,
  maxRaise,
}: ActionButtonsProps) {
  const [raiseAmount, setRaiseAmount] = React.useState(minRaise);

  // Обработчик изменения слайдера
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRaiseAmount(parseInt(e.target.value));
  };

  return (
    <div className="flex flex-col items-center space-y-4 p-4 bg-gray-800 rounded-lg">
      {/* Кнопки действий */}
      <div className="flex space-x-2">
        {canFold && (
          <button
            onClick={onFold}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            Сбросить
          </button>
        )}
        
        {canCheck && (
          <button
            onClick={onCheck}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
          >
            Пропустить
          </button>
        )}
        
        {canCall && (
          <button
            onClick={onCall}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Уравнять ${callAmount}
          </button>
        )}
        
        {canLook && (
          <button
            onClick={onLook}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            Посмотреть карты
          </button>
        )}
      </div>
      
      {/* Слайдер для повышения ставки */}
      {canRaise && (
        <div className="w-full">
          <div className="flex justify-between text-white text-sm mb-1">
            <span>${minRaise}</span>
            <span>${maxRaise}</span>
          </div>
          <input
            type="range"
            min={minRaise}
            max={maxRaise}
            value={raiseAmount}
            onChange={handleSliderChange}
            className="w-full"
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-white">Повысить до: ${raiseAmount}</span>
            <button
              onClick={() => onRaise(raiseAmount)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              Повысить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
