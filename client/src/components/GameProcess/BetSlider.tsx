import React, { useState, useEffect } from 'react';
import closeIcon from '../../assets/close.png';
import { StyledContainer } from '../StyledContainer';

interface BetSliderProps {
  minBet: number;
  maxBet: number;
  initialBet?: number;
  onChange?: (value: number) => void;
  onConfirm: (value: number) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function BetSlider({ 
  minBet, 
  maxBet, 
  initialBet, 
  onChange, 
  onConfirm,
  isOpen,
  onClose
}: BetSliderProps) {
  const [value, setValue] = useState(initialBet || minBet);
  const [percentage, setPercentage] = useState(0);

  // Reset value when the slider is reopened
  useEffect(() => {
    if (isOpen) {
      setValue(initialBet || minBet);
    }
  }, [isOpen, initialBet, minBet]);

  // Предустановленные множители ставок
  const multipliers: { label: string; value: number | 'max' }[] = [
    { label: '2x', value: 2 },
    { label: '5x', value: 5 },
    { label: '10x', value: 10 },
    { label: 'Max', value: 'max' },
  ];

  // Обновляем процент заполнения слайдера
  useEffect(() => {
    if (maxBet > minBet) {
      const percent = ((value - minBet) / (maxBet - minBet)) * 100;
      setPercentage(Math.max(0, Math.min(100, percent)));
    } else {
      setPercentage(100);
    }
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

  if (!isOpen) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end"
      onClick={onClose}
    >
      {/* Close Button - над компонентом */}
      <button 
        onClick={onClose} 
        className="absolute z-50"
        style={{ 
          top: 'calc(75vh - 60px)', 
          right: '7.5%', // 100% - 85% = 15%, делим пополам = 7.5%
          transform: 'translateX(50%)'
        }}
      >
        <img src={closeIcon} alt="Close" className="w-6 h-6" />
      </button>

      {/* Bottom Sheet Panel */}
      <div
        className={`w-full transition-transform duration-300 ease-out ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ height: 'calc(25vh + 20px)', paddingBottom: '20px' }}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the panel
      >
        {/* BetSlider Container - 85% ширины, border-radius 20px */}
        <div
          className="relative mx-auto"
          style={{
            width: '85%',
            height: '100%',
            background: 'linear-gradient(180deg, #48454D 0%, rgba(255, 255, 255, 0.3) 50%, #2D2B31 100%)',
            boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)',
            borderRadius: '20px',
          }}
        >
          {/* Inner background */}
          <div
            style={{
              position: 'absolute',
              inset: '1px',
              background: '#2E2B33',
              borderRadius: '19px', // 20px - 1px
              zIndex: 0,
            }}
          />
          
          {/* Content - без отдельного контейнера */}
          <div className="relative z-10 p-4 h-full flex flex-col justify-around">
            {/* Верхняя часть с индикатором и кнопкой */}
            <div className="flex items-center justify-between mb-4">
              {/* Индикатор Ставки */}
              <div className="w-[96px] bg-[#807C7C] h-[5px] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-green-500 to-green-400" 
                  style={{ width: `${percentage}%` }}
                />
              </div>
              {/* Дисплей суммы */}
              <div 
                className="flex items-center justify-center text-white font-bold text-[18px] leading-none"
                style={{ 
                  width: '79px', 
                  height: '33px',
                  backgroundColor: 'rgba(19, 18, 23, 0.5)',
                  borderRadius: '6px'
                }}
              >
                ${Number(value).toFixed(2)}
              </div>
              {/* Кнопка "Повысить" */}
              <button
                onClick={() => onConfirm(value)}
                className="w-1/4 h-[29px] text-white font-bold rounded-md transition flex items-center justify-center text-xs"
                style={{ backgroundColor: '#56BF00' }}
              >
                Повысить
              </button>
            </div>

            {/* Множители */}
            <div className="grid grid-cols-4 gap-2 mb-4 justify-items-center">
              {multipliers.map((mult, index) => (
                <button
                  key={index}
                  onClick={() => handleMultiplier(mult.value)}
                  className="font-medium text-xs leading-none transition flex items-center justify-center"
                  style={{
                    width: '27px',
                    height: '19px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    color: '#C9C6CE'
                  }}
                >
                  {mult.label}
                </button>
              ))}
            </div>

            {/* Слайдер */}
            <div className="flex justify-center">
              <StyledContainer className="w-[85%] h-[42px] rounded-[15px]" contentClassName="w-full h-full flex items-center justify-center">
                <div className="relative w-[82.5%] h-full flex items-center">
                  {/* Track background */}
                  <div className="w-full h-[5px] bg-[#807C7C] rounded-full" />
                  {/* Track progress */}
                  <div 
                    className="absolute h-[5px] bg-[#56BF00] rounded-full"
                    style={{ width: `${percentage}%` }}
                  />
                  {/* Invisible range input */}
                  <input
                    type="range"
                    min={minBet}
                    max={maxBet}
                    value={value}
                    onChange={handleChange}
                    className="absolute w-full h-full appearance-none bg-transparent cursor-pointer"
                    style={{ WebkitAppearance: 'none' }}
                  />
                  {/* Thumb */}
                  <div 
                    className="absolute top-1/2 -translate-y-1/2 w-7 h-7 bg-white rounded-full shadow-lg pointer-events-none"
                    style={{ left: `calc(${percentage}% - 14px)` }} // 14px is half of 28px width
                  />
                </div>
              </StyledContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
