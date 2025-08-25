import React, { useState, useEffect } from 'react';
import closeIcon from '../../assets/close.png';
import { StyledContainer } from '../StyledContainer';
import { TURN_DURATION_SECONDS } from '@/constants';
import { useTranslation } from 'react-i18next';

interface BetSliderProps {
  minBet: number;
  maxBet: number;
  initialBet?: number;
  onChange?: (value: number) => void;
  onConfirm: (value: number) => void;
  isOpen: boolean;
  onClose: () => void;
  isTurn?: boolean;
  turnTimer?: number;
  isProcessing?: boolean;
}

export function BetSlider({ 
  minBet, 
  maxBet, 
  initialBet, 
  onChange, 
  onConfirm,
  isOpen,
  onClose,
  isTurn = false,
  turnTimer = TURN_DURATION_SECONDS,
  isProcessing = false,
}: BetSliderProps) {
  const { t } = useTranslation('common');
  const [value, setValue] = useState(initialBet || minBet);
  const [percentage, setPercentage] = useState(0);

  // Reset value when the slider is reopened
  useEffect(() => {
    if (isOpen) {
      const initialValue = initialBet || minBet;
      // Ограничиваем начальное значение балансом пользователя
      const limitedInitialValue = Math.min(initialValue, maxBet);
      setValue(limitedInitialValue);
    }
  }, [isOpen, initialBet, minBet, maxBet]);

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
    // Ограничиваем значение балансом пользователя
    const limitedValue = Math.min(newValue, maxBet);
    setValue(limitedValue);
    if (onChange) {
      onChange(limitedValue);
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
    // Дополнительная проверка на баланс пользователя
    const limitedValue = Math.min(newValue, maxBet);
    setValue(limitedValue);
    if (onChange) {
      onChange(limitedValue);
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
          top: 'calc(75vh - 40px)', 
          right: '20px',
        }}
      >
        <img src={closeIcon} alt="Close" style={{ width: '19px', height: '19px' }} />
      </button>

      {/* Bottom Sheet Panel */}
      <div
        className={`w-full transition-transform duration-300 ease-out ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ height: '25vh' }}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the panel
      >
        {/* BetSlider Container - во всю ширину экрана */}
        <div
          className="relative w-full h-full"
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
              background: '#2E2B33',
              borderRadius: '19px', // 20px - 1px
              zIndex: 0,
            }}
          />
          
          {/* Content - без отдельного контейнера */}
          <div className="relative z-10 p-4 h-full flex flex-col justify-around">
            {/* Верхняя часть с индикатором и кнопкой */}
            <div className="flex items-center justify-between mb-4 w-[85%] mx-auto">
              {/* Таймер Хода */}
              {isTurn ? (
                <div className="w-[96px] h-[5px] bg-gray-600 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full"
                    style={{ 
                      width: `${(turnTimer / TURN_DURATION_SECONDS) * 100}%`, 
                      backgroundColor: `hsl(${(turnTimer / TURN_DURATION_SECONDS) * 120}, 100%, 50%)`,
                      transition: 'width 0.1s linear, background-color 0.1s linear'
                    }} 
                  />
                </div>
              ) : (
                <div className="w-[96px] h-[5px] rounded-full" />
              )}
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
                className={`w-1/4 h-[29px] text-white font-bold rounded-md transition flex items-center justify-center text-xs ${
                  value > maxBet || isProcessing ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                style={{ backgroundColor: value > maxBet || isProcessing ? '#666' : '#56BF00' }}
                disabled={value > maxBet || isProcessing}
              >
                {t('raise')}
              </button>
            </div>

            {/* Множители */}
            <div className="grid grid-cols-4 gap-2 mb-4 justify-items-center w-[85%] mx-auto">
              {multipliers.map((mult, index) => {
                // Проверяем, не превышает ли множитель баланс
                const multiplierValue = mult.value === 'max' ? maxBet : minBet * (mult.value as number);
                const isDisabled = multiplierValue > maxBet || isProcessing;
                
                return (
                  <button
                    key={index}
                    onClick={() => handleMultiplier(mult.value)}
                    className={`font-medium text-xs leading-none transition flex items-center justify-center ${
                      isDisabled ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    style={{
                      width: '27px',
                      height: '19px',
                      borderRadius: '4px',
                      backgroundColor: isDisabled ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.06)',
                      color: isDisabled ? '#666' : '#C9C6CE'
                    }}
                    disabled={isDisabled}
                  >
                    {mult.label}
                  </button>
                );
              })}
            </div>

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