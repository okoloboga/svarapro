import React, { useState, useEffect, useRef } from 'react';
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
  const [position, setPosition] = useState({ x: fromX, y: fromY });
  const [isAnimating, setIsAnimating] = useState(false);
  const animationRef = useRef<number>();
  const startTimeRef = useRef<number>();

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAnimating(true);
      startTimeRef.current = Date.now();
      
      const animate = () => {
        if (!startTimeRef.current) return;
        
        const elapsed = Date.now() - startTimeRef.current;
        const duration = 1000; // 1 секунда
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function для более естественного движения
        const easeOut = 1 - Math.pow(1 - progress, 3);
        
        const newX = fromX + (toX - fromX) * easeOut;
        const newY = fromY + (toY - fromY) * easeOut;
        
        setPosition({ x: newX, y: newY });
        
        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          onComplete();
        }
      };
      
      animationRef.current = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(timer);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [delay, onComplete, fromX, fromY, toX, toY]);

  if (!isAnimating) return null;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '13px',
        height: '11px',
        zIndex: 1000,
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