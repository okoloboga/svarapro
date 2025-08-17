import React, { useState, useEffect } from 'react';
import coinImage from '../../assets/game/coin.png';

interface ChipsStackProps {
  totalChips: number;
}

interface ChipPosition {
  x: number;
  y: number;
  opacity: number;
  zIndex: number;
}

const ChipsStack: React.FC<ChipsStackProps> = ({ totalChips }) => {
  const [chipPositions, setChipPositions] = useState<ChipPosition[]>([]);

  // Вычисляем позиции фишек в столбиках
  useEffect(() => {
    const positions: ChipPosition[] = [];
    const chipsPerStack = 5;
    
    for (let i = 0; i < totalChips; i++) {
      const stackIndex = Math.floor(i / chipsPerStack);
      const chipInStack = i % chipsPerStack;
      
      // Позиции столбиков (относительно центра стола)
      let baseX = 0;
      let baseY = 0;
      
      if (stackIndex === 0) {
        baseX = 0;
        baseY = 0;
      } else if (stackIndex === 1) {
        baseX = 13;
        baseY = -5;
      } else if (stackIndex === 2) {
        baseX = 12;
        baseY = 7;
      }
      
      // Позиция фишки в столбике (слой за слоем)
      const x = baseX;
      const y = baseY - (chipInStack * 4); // 4px шаг между слоями
      
      // Прозрачность: верхняя фишка полная, остальные затемнены
      const opacity = chipInStack === 0 ? 1 : 0.6;
      
      // Z-index: чем выше в столбике, тем больше z-index
      const zIndex = chipInStack;
      
      positions.push({ x, y, opacity, zIndex });
    }
    
    setChipPositions(positions);
  }, [totalChips]);

  if (totalChips === 0) return null;

  return (
    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" style={{ zIndex: 1, marginTop: '30px' }}>
      {chipPositions.map((position, index) => (
        <div
          key={index}
          className="absolute transition-all duration-1000"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            opacity: position.opacity,
            zIndex: position.zIndex,
            width: '13px',
            height: '11px',
          }}
        >
          <img 
            src={coinImage} 
            alt="chip" 
            className="w-full h-full object-contain"
          />
        </div>
      ))}
    </div>
  );
};

export default ChipsStack; 