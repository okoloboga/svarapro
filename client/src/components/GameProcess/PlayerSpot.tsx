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
  gameState?: any;
}

export function PlayerSpot({ player, isCurrentUser, showCards, scale = 1, gameState }: PlayerSpotProps) {
  const { username, avatar, balance, tableBalance, cards, isActive, hasFolded, hasLooked, lastAction, score } = player;
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

  // Динамические размеры карт на основе размера аватарки
  // Высота карты = 1.5 * высота аватарки
  const cardHeight = Math.round(avatarSize * 1.5);
  // Ширина карты = высота * (65/90) для сохранения пропорций PNG
  const cardWidth = Math.round(cardHeight * (65/90));
  // Шаг между картами = ширина карты * 0.46 (30/65)
  const step = Math.round(cardWidth * 0.46);

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
                    style={{
                      color: 'rgba(255, 255, 255, 0.8)',
                      fontSize: `${10 * scale}px`,
                      borderBottom: `${1 * scale}px solid rgba(255, 255, 255, 0.07)`
                    }}
                  >
                    {username}
                  </div>
                  <div
                    className="font-bold"
                    style={{ color: '#D2A21B', fontSize: `${10 * scale}px` }}
                  >
                    ${balance}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
        
        {/* Revealed Cards - показываем только если игрок посмотрел карты или игра закончилась */}
        {(showCards || (isCurrentUser && hasLooked)) && (
          <div className="absolute left-1/2 transform -translate-x-1/2 z-50" style={{ 
            top: `${-60 * scale}px`, 
            width: `${cardWidth}px`, 
            height: `${cardHeight}px`
          }}>
            <div className="relative w-full h-full">
              {cards.map((card, index) => {
                const centerOffset = (cards.length - 1) * step / 2;
                const left = index * step - centerOffset;
                
                // Углы поворота: левая карта -12°, центральная 0°, правая +12°
                const rotation = index === 0 ? -12 : index === 1 ? 0 : 12;
                
                // Боковые карты ниже центральной на 4px
                const topOffset = index === 1 ? 0 : 4;
                
                return (
                  <div
                    key={index}
                    className="absolute"
                    style={{
                      left: `${left}px`,
                      top: `${topOffset}px`,
                      width: `${cardWidth}px`,
                      height: `${cardHeight}px`,
                      transform: `rotate(${rotation}deg)`,
                      zIndex: index + 1
                    }}
                  >
                    <CardComponent
                      card={card}
                      hidden={false}
                      customWidth={cardWidth}
                      customHeight={cardHeight}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Card deck - показываем только в blind фазе (когда игрок не посмотрел карты) */}
        {!hasFolded && !hasLooked && (
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
        {tableBalance > 0 && gameState?.status !== 'ante' && (
          <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-2 py-1 rounded-full z-40" style={{ fontSize: `${12 * scale}px` }}>
            ${tableBalance}
          </div>
        )}
        
        {/* Score display - показываем только когда карты открыты и есть очки */}
        {score !== undefined && (showCards || (isCurrentUser && hasLooked)) && (
          <div 
            className="absolute z-40 flex items-center justify-center"
            style={{ 
              left: `${-45 * scale}px`,
              top: `${-11 * scale}px`,
              width: `${22 * scale}px`,
              height: `${22 * scale}px`,
              backgroundColor: '#FF443A',
              borderRadius: '50%'
            }}
          >
            <span
              style={{
                fontWeight: 500,
                fontStyle: 'normal',
                fontSize: `${14 * scale}px`,
                lineHeight: '100%',
                letterSpacing: '0%',
                textAlign: 'center',
                verticalAlign: 'middle',
                color: '#FFFFFF'
              }}
            >
              {score}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
