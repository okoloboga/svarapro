import React from 'react';
import { Card } from '@/types/game';

interface CardComponentProps {
  card?: Card;
  hidden?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export function CardComponent({ card, hidden = false, size = 'medium' }: CardComponentProps) {
  if (!card && !hidden) {
    return null;
  }

  const sizeClasses = {
    small: 'w-10 h-14',
    medium: 'w-16 h-24',
    large: 'w-20 h-32',
  };

  const getSuitColor = (suit?: string) => {
    if (!suit) return 'text-gray-700';
    return suit === 'hearts' || suit === 'diamonds' ? 'text-red-600' : 'text-black';
  };

  const getSuitSymbol = (suit?: string) => {
    if (!suit) return '';
    switch (suit) {
      case 'hearts': return '♥';
      case 'diamonds': return '♦';
      case 'clubs': return '♣';
      case 'spades': return '♠';
      default: return '';
    }
  };

  if (hidden) {
    return (
      <div className={`${sizeClasses[size]} rounded-lg bg-blue-800 border-2 border-blue-600 shadow-md flex items-center justify-center`}>
        <div className="text-white text-2xl font-bold">?</div>
      </div>
    );
  }

  const isJoker = card?.isJoker;
  const suitColor = getSuitColor(card?.suit);
  const suitSymbol = getSuitSymbol(card?.suit);

  return (
    <div className={`${sizeClasses[size]} rounded-lg bg-white border border-gray-300 shadow-md flex flex-col p-1`}>
      <div className={`flex justify-between ${suitColor}`}>
        <div className="text-sm font-bold">{card?.rank}</div>
        <div className="text-sm">{suitSymbol}</div>
      </div>
      <div className="flex-grow flex items-center justify-center">
        <div className={`text-2xl ${suitColor} ${isJoker ? 'font-bold' : ''}`}>
          {isJoker ? 'J' : suitSymbol}
        </div>
      </div>
      <div className={`flex justify-between ${suitColor} rotate-180`}>
        <div className="text-sm font-bold">{card?.rank}</div>
        <div className="text-sm">{suitSymbol}</div>
      </div>
    </div>
  );
}
