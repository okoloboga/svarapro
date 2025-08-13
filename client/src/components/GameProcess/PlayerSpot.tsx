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
      <div className="relative">
        {/* Уведомление о действии */}
        <ActionNotification
          action={notificationType}
          visible={showNotification}
          onHide={() => setShowNotification(false)}
        />

        {/* Main container for positioning */}
        <div className="relative flex justify-center items-start" style={{ width: `${avatarSize}px`, height: `${avatarSize + nameHeight / 1.5}px` }}>

          {/* Avatar is the central element */}
          <div className="relative z-10" style={{ width: `${avatarSize}px`, height: `${avatarSize}px` }}>
            {/* Bottom Layer (Gray) */}
            <div
              className="absolute rounded-full top-0 left-0"
              style={{ width: `${avatarSize}px`, height: `${avatarSize}px`, backgroundColor: '#555456' }}
            ></div>
            {/* Middle Layer (White) */}
            <div
              className="absolute rounded-full top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
              style={{ width: `${avatarSize - (6 * scale)}px`, height: `${avatarSize - (6 * scale)}px`, backgroundColor: '#ECEBF5' }}
            ></div>
            {/* Top Layer (Avatar) */}
            <div
              className="absolute rounded-full overflow-hidden top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
              style={{ width: `${avatarSize - (10 * scale)}px`, height: `${avatarSize - (10 * scale)}px` }}
            >
              {avatar ? (
                <img src={avatar} alt={username} className="w-full h-full object-cover" />
              ) : (
                <img src={defaultAvatar} alt={username} className="w-full h-full object-cover" />
              )}
            </div>
          </div>

          {/* Info block, overlapping the bottom of the avatar */}
          <div className="absolute left-1/2 transform -translate-x-1/2 z-20" style={{ bottom: '-4px' }}>
            <div className="flex flex-col items-center">
              {/* Name */}
              <div className="relative" style={{ width: `${nameWidth}px`, height: `${nameHeight}px` }}>
                <div
                  className="absolute inset-0"
                  style={{
                    borderRadius: `${8 * scale}px`,
                    background: 'linear-gradient(180deg, #48454D 0%, rgba(255, 255, 255, 0.3) 50%, #2D2B31 100%)'
                  }}
                ></div>
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
                    style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: `${10 * scale}px` }}
                  >
                    {username}
                  </div>
                  <div
                    style={{ width: `${66 * scale}px`, height: `${1 * scale}px`, backgroundColor: 'rgba(255, 255, 255, 0.3)' }}
                  ></div>
                  <div
                    className="font-bold"
                    style={{ color: '#D2A21B', fontSize: `${10 * scale}px` }}
                  >
                    ${balance}
                  </div>
                </div>
              </div>
              {/* Revealed Cards */}
              <div className="flex space-x-1 mt-1 justify-center">
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
          </div>
        </div>
        
        {/* Card deck, positioned to the right and overlapping */}
        {!hasFolded && (
          <div className="absolute top-1/2 right-0 transform -translate-y-1/2 z-30" style={{ top: '40%', left: '50px' }}>
            <div className="relative" style={{ width: '42px', height: '42px' }}>
              <img
                src={cardBack}
                alt="card back"
                className="absolute rounded-sm"
                style={{ width: '30px', height: '42px', zIndex: 3, top: '0', left: '0' }}
              />
              <img
                src={cardBack}
                alt="card back"
                className="absolute rounded-sm"
                style={{ width: '30px', height: '42px', zIndex: 2, top: '0', left: '4px' }}
              />
              <img
                src={cardBack}
                alt="card back"
                className="absolute rounded-sm"
                style={{ width: '30px', height: '42px', zIndex: 1, top: '0', left: '8px' }}
              />
            </div>
          </div>
        )}

        {/* Other absolutely positioned elements */}
        {getPlayerStatus() && (
          <div className="absolute -top-2 right-0 bg-gray-800 text-white px-2 py-1 rounded-full z-40" style={{ fontSize: `${12 * scale}px` }}>
            {getPlayerStatus()}
          </div>
        )}
        {tableBalance > 0 && (
          <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-2 py-1 rounded-full z-40" style={{ fontSize: `${12 * scale}px` }}>
            ${tableBalance}
          </div>
        )}
      </div>
    </div>
  );
}
