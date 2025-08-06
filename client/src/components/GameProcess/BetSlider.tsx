import React, { useState, useEffect } from 'react';

interface BetSliderProps {
  minBet: number;
  maxBet: number;
  initialBet?: number;
  onChange?: (value: number) => void;
  onConfirm: (value: number) => void;
}

export function BetSlider({ minBet, maxBet, initialBet, onChange, onConfirm }: BetSliderProps) {
  const [value, setValue] = useState(initialBet || minBet);
  const [percentage, setPercentage] = useState(0);

  // Предустановленные множители ставок
  const multipliers: { label: string; value: number | 'max' }[] = [
    { label: '2x', value: 2 },
    { label: '5x', value: 5 },
    { label: '10x', value: 10 },
    { label: 'Max', value: 'max' },
  ];

  // Обновляем процент заполнения слайдера
  useEffect(() => {
    const percent = ((value - minBet) / (maxBet - minBet)) * 100;
    setPercentage(Math.max(0, Math.min(100, percent)));
  }, [value, minBet, maxBet]);

  // Обработчик изменения значения слайдера
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value);
    setValue(newValue);
    if (onChange) {
      onChange(newValue);
    }
  };

  // Обработчик нажатия на множитель
  const handleMultiplier = (multiplier: number | 'max') => {
    let newValue;
    if (multiplier === 'max') {
      newValue = maxBet;
    } else {
      newValue = Math.min(maxBet, minBet * multiplier);
    }
    setValue(newValue);
    if (onChange) {
      onChange(newValue);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 shadow-lg">
      {/* Верхняя часть с индикатором и кнопкой */}
      <div className="flex items-center justify-between mb-4">
        <div className="w-1/2 bg-gray-700 h-2 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-green-500 to-green-400" 
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="bg-gray-900 text-white text-xl font-bold px-4 py-2 rounded-md">
          ${value}
        </div>
        <button
          onClick={() => onConfirm(value)}
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition"
        >
          Повысить
        </button>
      </div>

      {/* Множители */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {multipliers.map((mult, index) => (
          <button
            key={index}
            onClick={() => handleMultiplier(mult.value)}
            className="bg-gray-700 hover:bg-gray-600 text-white py-1 rounded-md transition"
          >
            {mult.label}
          </button>
        ))}
      </div>

      {/* Слайдер */}
      <div className="relative bg-gray-700 rounded-full p-1">
        <input
          type="range"
          min={minBet}
          max={maxBet}
          value={value}
          onChange={handleChange}
          className="w-full appearance-none bg-transparent"
          style={{
            // Скрываем стандартный слайдер, но оставляем функциональность
            WebkitAppearance: 'none',
            height: '2px',
          }}
        />
        <div 
          className="absolute top-1/2 transform -translate-y-1/2 w-6 h-6 bg-white rounded-full shadow-lg"
          style={{ left: `calc(${percentage}% - 12px)` }}
        />
      </div>
    </div>
  );
}
