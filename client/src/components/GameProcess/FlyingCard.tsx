import React, { useEffect, useRef, useState } from 'react';
import { Card } from '@/types/game';
import { CardComponent } from './CardComponent';

interface FlyingCardProps {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  width?: number;
  height?: number;
  rotation?: number;
  transformOrigin?: string;
  zIndex?: number;
  delay?: number;
  duration?: number;
  cardId: string;
  playerId: string;
  card?: Card;
  hidden?: boolean;
  onComplete: (cardId: string, playerId: string) => void;
}

const DEFAULT_WIDTH = 32;
const DEFAULT_HEIGHT = 44;

const FlyingCard: React.FC<FlyingCardProps> = ({
  fromX,
  fromY,
  toX,
  toY,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  rotation = 0,
  transformOrigin = '50% 50%',
  zIndex = 2000,
  delay = 0,
  duration = 1000,
  cardId,
  playerId,
  card,
  hidden = false,
  onComplete,
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [position, setPosition] = useState({ x: fromX, y: fromY, rotation: 0 });
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const hasCompletedRef = useRef(false);

  useEffect(() => {
    setPosition({ x: fromX, y: fromY, rotation: 0 });
    hasCompletedRef.current = false;

    const timer = window.setTimeout(() => {
      setIsAnimating(true);
      startTimeRef.current = performance.now();

      const animate = () => {
        if (startTimeRef.current === null) {
          return;
        }

        const elapsed = performance.now() - startTimeRef.current;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);

        const newX = fromX + (toX - fromX) * easeOut;
        const newY = fromY + (toY - fromY) * easeOut;
        const newRotation = rotation * easeOut;

        setPosition({ x: newX, y: newY, rotation: newRotation });

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else if (!hasCompletedRef.current) {
          hasCompletedRef.current = true;
          setPosition({ x: toX, y: toY, rotation });
          onComplete(cardId, playerId);
        }
      };

      animationRef.current = requestAnimationFrame(animate);
    }, delay);

    return () => {
      window.clearTimeout(timer);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [delay, duration, fromX, fromY, toX, toY, rotation, cardId, playerId, onComplete]);

  useEffect(() => () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  if (!isAnimating) {
    return null;
  }

  return (
    <div
      className="absolute pointer-events-none will-change-transform"
      style={{
        left: position.x,
        top: position.y,
        width,
        height,
        zIndex,
        transform: `rotate(${position.rotation}deg)`,
        transformOrigin,
      }}
    >
      <CardComponent
        card={card}
        hidden={hidden}
        customWidth={width}
        customHeight={height}
      />
    </div>
  );
};

export default FlyingCard;
