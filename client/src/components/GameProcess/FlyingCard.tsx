import React, { useState, useEffect, useRef } from 'react';
import cardBackImage from '../../assets/game/back.png';

interface FlyingCardProps {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  onComplete: (cardId: string, playerId: string) => void;
  cardId: string;
  playerId: string;
  delay?: number;
}

const FlyingCard: React.FC<FlyingCardProps> = ({ fromX, fromY, toX, toY, onComplete, cardId, playerId, delay = 0 }) => {
  const [position, setPosition] = useState({ x: fromX, y: fromY });
  const [isAnimating, setIsAnimating] = useState(false);
  const animationRef = useRef<number | undefined>(undefined);
  const startTimeRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAnimating(true);
      startTimeRef.current = Date.now();
      
      const animate = () => {
        if (!startTimeRef.current) return;
        
        const elapsed = Date.now() - startTimeRef.current;
        const duration = 1000; // 1 second
        const progress = Math.min(elapsed / duration, 1);
        
        // Use easing for a smoother travel
        const easeOut = 1 - Math.pow(1 - progress, 3);
        
        const newX = fromX + (toX - fromX) * easeOut;
        const newY = fromY + (toY - fromY) * easeOut;
        
        setPosition({ x: newX, y: newY });
        
        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          onComplete(cardId, playerId);
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
  }, [delay, onComplete, cardId, playerId, fromX, fromY, toX, toY]);

  if (!isAnimating) return null;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '32px',
        height: '44px',
        zIndex: 1000,
      }}
    >
      <img 
        src={cardBackImage} 
        alt="flying card" 
        className="w-full h-full object-contain"
      />
    </div>
  );
};

export default FlyingCard; 
