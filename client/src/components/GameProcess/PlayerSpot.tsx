import { useState, useEffect } from 'react';
import { Player } from '@/types/game';
import { CardComponent } from './CardComponent';
import { ActionNotification } from './ActionNotification';
import starImage from '@/assets/game/star.png';

interface PlayerSpotProps {
  player: Player;
  isCurrentPlayer: boolean;
  isCurrentUser: boolean;
  showCards: boolean;
}

export function PlayerSpot({ player, isCurrentPlayer, isCurrentUser, showCards }: PlayerSpotProps) {
  const { username, avatar, balance, tableBalance, cards, isActive, hasFolded, hasLooked, lastAction } = player;
  const [showNotification, setShowNotification] = useState(false);
  const [notificationType, setNotificationType] = useState<'blind' | 'paid' | 'pass' | 'rais' | 'win' | null>(null);

  // Показываем уведомление при изменении действия игрока
  useEffect(() => {
    if (lastAction) {
      let actionType: 'blind' | 'paid' | 'pass' | 'rais' | 'win' | null = null;
      
      switch (lastAction) {
        case 'blind':
          actionType = 'blind';
          break;
        case 'call':
          actionType = 'paid';
          break;
        case 'fold':
          actionType = 'pass';
          break;
        case 'raise':
          actionType = 'rais';
          break;
        default:
          actionType = null;
      }
      
      if (actionType) {
        setNotificationType(actionType);
        setShowNotification(true);
      }
    }
  }, [lastAction]);

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
      {/* Уведомление о действии */}
      <ActionNotification 
        action={notificationType}
        visible={showNotification}
        onHide={() => setShowNotification(false)}
      />
      
      {/* Индикатор текущего игрока */}
      {isCurrentPlayer && (
        <div className="absolute -top-3 -right-3">
          <img src={starImage} alt="Current player" className="w-6 h-6" />
        </div>
      )}
      
      {/* Аватар и имя */}
      <div className="flex flex-col items-center mb-2">
        <div className="relative w-[71px] h-[71px] flex items-center justify-center mb-1">
          {/* Bottom Layer */}
          <div 
            className="absolute rounded-full"
            style={{ width: '71px', height: '71px', backgroundColor: '#ECEBF5' }}
          ></div>
          {/* Middle Layer */}
          <div 
            className="absolute rounded-full"
            style={{ width: '65px', height: '65px', backgroundColor: '#555456' }}
          ></div>
          {/* Top Layer (Avatar) */}
          <div 
            className="absolute rounded-full overflow-hidden"
            style={{ width: '61px', height: '61px' }}
          >
            <img src={avatar || 'https://via.placeholder.com/61'} alt={username} className="w-full h-full object-cover" />
          </div>
        </div>
        <div>
          <div className="font-semibold text-sm text-center">{username}</div>
          <div className="text-xs text-gray-600 text-center">${balance}</div>
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
