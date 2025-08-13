import { useState, useEffect } from 'react';
import { Player } from '@/types/game';
import { CardComponent } from './CardComponent';
import { ActionNotification } from './ActionNotification';
import defaultAvatar from '@/assets/main_logo.png';
import cardBack from '@/assets/game/back.png';

interface PlayerSpotProps {
  player: Player;
  isCurrentUser: boolean;
  showCards: boolean;
  scale?: number;
}

export function PlayerSpot({ player, isCurrentUser, showCards, scale = 1 }: PlayerSpotProps) {
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

  // Базовые размеры
  const baseAvatarSize = 71;
  const baseNameWidth = 70;
  const baseNameHeight = 32;
  
  // Масштабированные размеры
  const avatarSize = baseAvatarSize * scale;
  const nameWidth = baseNameWidth * scale;
  const nameHeight = baseNameHeight * scale;

  // Определяем стили для рамки игрока
  const spotClasses = `
    relative rounded-lg p-3 flex items-center
    ${hasFolded ? 'opacity-60' : ''}
  `;

  const containerStyle: React.CSSProperties = {
    transform: `scale(${scale})`,
    transformOrigin: 'center center',
  };

  return (
    <div className={spotClasses} style={containerStyle}>
      <div className="flex items-center">
        <div className="flex flex-col items-center">
          {/* Уведомление о действии */}
          <ActionNotification 
            action={notificationType}
            visible={showNotification}
            onHide={() => setShowNotification(false)}
          />
          
          {/* Аватар и имя */}
          <div className="flex flex-col items-center mb-2">
            <div className="relative flex items-center justify-center mb-1" style={{ width: `${avatarSize}px`, height: `${avatarSize}px` }}>
              {/* Bottom Layer */}
              <div 
                className="absolute rounded-full"
                style={{ width: `${avatarSize}px`, height: `${avatarSize}px`, backgroundColor: '#ECEBF5' }}
              ></div>
              {/* Middle Layer */}
              <div 
                className="absolute rounded-full"
                style={{ width: `${(avatarSize - 6) * scale}px`, height: `${(avatarSize - 6) * scale}px`, backgroundColor: '#555456' }}
              ></div>
              {/* Top Layer (Avatar) */}
              <div 
                className="absolute rounded-full overflow-hidden"
                style={{ width: `${(avatarSize - 10) * scale}px`, height: `${(avatarSize - 10) * scale}px` }}
              >
                {avatar ? (
                  <img src={avatar} alt={username} className="w-full h-full object-cover" />
                ) : (
                  <img src={defaultAvatar} alt={username} className="w-full h-full object-cover" />
                )}
              </div>
            </div>
            <div className="relative" style={{ width: `${nameWidth}px`, height: `${nameHeight}px` }}>
              {/* Bottom Layer (Border) */}
              <div 
                className="absolute inset-0"
                style={{
                  borderRadius: `${8 * scale}px`,
                  background: 'linear-gradient(180deg, #48454D 0%, rgba(255, 255, 255, 0.3) 50%, #2D2B31 100%)'
                }}
              ></div>
              {/* Top Layer (Content) */}
              <div 
                className="absolute flex flex-col items-center justify-center"
                style={{
                  top: `${1 * scale}px`, left: `${1 * scale}px`, right: `${1 * scale}px`, bottom: `${1 * scale}px`,
                  borderRadius: `${7 * scale}px`,
                  background: 'linear-gradient(to top, #000000, #36333B)'
                }}
              >
                <div 
                  className="font-bold"
                  style={{ 
                    color: 'rgba(255, 255, 255, 0.8)',
                    fontSize: `${10 * scale}px`
                  }}
                >
                  {username}
                </div>
                <div 
                  style={{
                    width: `${66 * scale}px`,
                    height: `${1 * scale}px`,
                    backgroundColor: 'rgba(255, 255, 255, 0.07)'
                  }}
                ></div>
                <div 
                  className="font-bold"
                  style={{ 
                    color: '#D2A21B',
                    fontSize: `${10 * scale}px`
                  }}
                >
                  ${balance}
                </div>
              </div>
            </div>
          </div>

          {/* Статус игрока */}
          {getPlayerStatus() && (
            <div className="absolute -top-2 right-0 bg-gray-800 text-white px-2 py-1 rounded-full" style={{ fontSize: `${12 * scale}px` }}>
              {getPlayerStatus()}
            </div>
          )}

          {/* Ставка на столе */}
          {tableBalance > 0 && (
            <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-2 py-1 rounded-full" style={{ fontSize: `${12 * scale}px` }}>
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
                scale={scale}
              />
            ))}
          </div>
        </div>
        
        {/* Three stacked cards to the right */}
        {!hasFolded && (
          <div className="relative w-12 h-16 ml-2">
            <img
              src={cardBack}
              alt="card back"
              className="absolute rounded-sm"
              style={{ width: '32px', height: '44px', zIndex: 1, top: '0', left: '0' }}
            />
            <img
              src={cardBack}
              alt="card back"
              className="absolute rounded-sm"
              style={{ width: '32px', height: '44px', zIndex: 2, top: '0', left: '4px' }}
            />
            <img
              src={cardBack}
              alt="card back"
              className="absolute rounded-sm"
              style={{ width: '32px', height: '44px', zIndex: 3, top: '0', left: '8px' }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
