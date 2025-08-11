import { useState, useEffect } from 'react';
import { Player } from '@/types/game';
import { CardComponent } from './CardComponent';
import { ActionNotification } from './ActionNotification';

interface PlayerSpotProps {
  player: Player;
  showCards: boolean;
}

export function PlayerSpot({ player, showCards }: PlayerSpotProps) {
  const { username, avatar, balance, tableBalance, cards, isActive, hasFolded, hasLooked, lastAction } = player;
  console.log('PlayerSpot avatar:', avatar);
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
    ${hasFolded ? 'opacity-60' : ''}
  `;

  return (
    <div className={spotClasses}>
      {/* Уведомление о действии */}
      <ActionNotification 
        action={notificationType}
        visible={showNotification}
        onHide={() => setShowNotification(false)}
      />
      
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
        <div className="relative" style={{ width: '70px', height: '32px' }}>
          {/* Bottom Layer (Border) */}
          <div 
            className="absolute inset-0"
            style={{
              borderRadius: '8px',
              background: 'linear-gradient(180deg, #48454D 0%, rgba(255, 255, 255, 0.3) 50%, #2D2B31 100%)'
            }}
          ></div>
          {/* Top Layer (Content) */}
          <div 
            className="absolute flex flex-col items-center justify-center"
            style={{
              top: '1px', left: '1px', right: '1px', bottom: '1px',
              borderRadius: '7px',
              background: 'linear-gradient(to top, #000000, #36333B)'
            }}
          >
            <div 
              className="font-bold text-[10px]"
              style={{ color: 'rgba(255, 255, 255, 0.8)' }}
            >
              {username}
            </div>
            <div 
              style={{
                width: '66px',
                height: '1px',
                backgroundColor: 'rgba(255, 255, 255, 0.07)'
              }}
            ></div>
            <div 
              className="font-bold text-[10px]"
              style={{ color: '#D2A21B' }}
            >
              ${balance}
            </div>
          </div>
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
