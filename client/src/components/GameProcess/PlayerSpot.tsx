import React from 'react';
import { Player } from '@/types/game';
import { CardComponent } from '@/components/CardComponent';

interface PlayerSpotProps {
  player: Player;
  isCurrentPlayer: boolean;
  isCurrentUser: boolean;
  showCards: boolean;
}

export function PlayerSpot({ player, isCurrentPlayer, isCurrentUser, showCards }: PlayerSpotProps) {
  const { username, avatar, balance, tableBalance, cards, isActive, hasFolded, hasLooked, lastAction } = player;

  // Определяем статус игрока
  const getPlayerStatus = () => {
    if (!isActive) return 'Неактивен';
    if (hasFolded) return 'Сбросил';
    if (lastAction) {
      switch (lastAction) {
        case 'fold': return 'Сбросил';
        case 'check': return 'Пропустил';
        case 'call': return 'Уравнял';
        case 'raise': return 'Повысил';
        case 'blind': return 'Вслепую';
        default: return '';
      }
    }
    return '';
  };

  // Определяем стили для рамки игрока
  const spotClasses = `
    relative rounded-lg p-3 flex flex-col items-center
    ${isCurrentPlayer ? 'bg-yellow-100 border-2 border-yellow-400' : 'bg-gray-100 border border-gray-300'}
    ${hasFolded ? 'opacity-60' : ''}
    ${isCurrentUser ? 'bg-blue-100' : ''}
  `;

  return (
    <div className={spotClasses}>
      {/* Аватар и имя */}
      <div className="flex items-center mb-2">
        <div className="w-10 h-10 rounded-full overflow-hidden mr-2">
          <img src={avatar || 'https://via.placeholder.com/40'} alt={username} className="w-full h-full object-cover" />
        </div>
        <div>
          <div className="font-semibold text-sm">{username}</div>
          <div className="text-xs text-gray-600">${balance}</div>
        </div>
      </div>

      {/* Статус игрока */}
      {getPlayerStatus() && (
        <div className="absolute -top-2 right-0 bg-gray-800 text-white text-xs px-2 py-1 rounded-full">
          {getPlayerStatus()}
        </div>
      )}

      {/* Ставка на столе */}
      {tableBalance > 0 && (
        <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 bg-green-600 text-white text-xs px-2 py-1 rounded-full">
          ${tableBalance}
        </div>
      )}

      {/* Карты игрока */}
      <div className="flex space-x-1 mt-2">
        {cards.map((card, index) => (
          <CardComponent 
            key={index} 
            card={showCards || (isCurrentUser && hasLooked) ? card : undefined} 
            hidden={!showCards && (!isCurrentUser || !hasLooked)}
            size="small" 
          />
        ))}
      </div>
    </div>
  );
}
