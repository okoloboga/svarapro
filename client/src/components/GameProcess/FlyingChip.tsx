import React, { useState, useEffect } from 'react';
import coinImage from '../../assets/game/coin.png';

interface FlyingChipProps {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  onComplete: () => void;
  delay?: number;
}

const FlyingChip: React.FC<FlyingChipProps> = ({ fromX, fromY, toX, toY, onComplete, delay = 0 }) => {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAnimating(true);
      
      // Анимация длится 1 секунду
      const animationTimer = setTimeout(() => {
        onComplete();
      }, 1000);
      
      return () => clearTimeout(animationTimer);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay, onComplete]);

  if (!isAnimating) return null;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${fromX}px`,
        top: `${fromY}px`,
        width: '13px',
        height: '11px',
        transition: 'all 1s ease-out',
        transform: `translate(${toX - fromX}px, ${toY - fromY}px)`,
      }}
    >
      <img 
        src={coinImage} 
        alt="flying chip" 
        className="w-full h-full object-contain"
      />
    </div>
  );
};

export default FlyingChip; 