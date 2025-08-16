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
  cardSide?: 'left' | 'right';
  isTurn?: boolean;
  onTimeout?: () => void;
}

export function PlayerSpot({ player, isCurrentUser, showCards, scale = 1, cardSide = 'right', isTurn = false, onTimeout }: PlayerSpotProps) {
  const { username, avatar, balance, tableBalance, cards, hasFolded, hasLooked, lastAction, score } = player;
  const [notificationType, setNotificationType] = useState<'blind' | 'paid' | 'pass' | 'rais' | 'win' | null>(null);
  const [progress, setProgress] = useState(100);

  // Set notification type based on last action
  useEffect(() => {
    if (lastAction && !isCurrentUser) {
      let actionType: 'blind' | 'paid' | 'pass' | 'rais' | 'win' | null = null;
      switch (lastAction) {
        case 'blind': actionType = 'blind'; break;
        case 'call': actionType = 'paid'; break;
        case 'fold': actionType = 'pass'; break;
        case 'raise': actionType = 'rais'; break;
        default: actionType = null;
      }
      setNotificationType(actionType);
    } else if (!lastAction || isCurrentUser) {
        setNotificationType(null);
    }
  }, [lastAction, isCurrentUser]);

  // Turn timer progress bar logic
  useEffect(() => {
    if (isTurn && isCurrentUser) {
      setProgress(100);
      const startTime = Date.now();
      const duration = 10000; // 10 seconds

      const interval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        const newProgress = 100 - (elapsedTime / duration) * 100;
        
        if (newProgress <= 0) {
          setProgress(0);
          clearInterval(interval);
          if (onTimeout) onTimeout();
        } else {
          setProgress(newProgress);
        }
      }, 100);

      return () => clearInterval(interval);
    } else {
      setProgress(100);
    }
  }, [isTurn, isCurrentUser, onTimeout]);

  const getPlayerStatus = () => {
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

  const baseAvatarSize = 71;
  const baseNameWidth = 70;
  const baseNameHeight = 32;
  
  const avatarSize = baseAvatarSize * scale;
  const nameWidth = baseNameWidth * scale;
  const nameHeight = baseNameHeight * scale;

  const cardHeight = Math.round(avatarSize * 1.2);
  const cardWidth = Math.round(cardHeight * (65/90));
  const step = Math.round(cardWidth * 0.46);

  const spotClasses = `
    relative rounded-lg p-3 flex items-center
    ${hasFolded ? 'opacity-60' : ''}
  `;

  const containerStyle: React.CSSProperties = {
    transform: `scale(${scale})`,
    transformOrigin: 'center center',
  };

  const cardDeckStyle: React.CSSProperties = {
    position: 'absolute',
    top: '40%',
    transform: 'translateY(-50%)',
    zIndex: 30,
  };

  if (cardSide === 'left') {
    cardDeckStyle.right = '50px';
  } else {
    cardDeckStyle.left = '50px';
  }

  const TotalBetComponent = !isCurrentUser && player.totalBet > 0 && (
    <div 
      className="text-white font-semibold text-xs leading-4 flex items-center justify-center"
      style={{
        width: '34px',
        height: '17px',
        borderRadius: '8px',
        backgroundColor: 'rgba(35, 34, 40, 0.61)',
      }}
    >
      {player.totalBet}
    </div>
  );

  const DealerIcon = player.isDealer && (
    <div 
      className="w-[15px] h-[15px] bg-black rounded-full flex items-center justify-center text-white font-bold text-[10px]"
    >
      D
    </div>
  );

  const CardDeckComponent = (
    <div className="flex flex-col items-center space-y-1">
      <div className="relative" style={{ width: '42px', height: '42px' }}>
        <img src={cardBack} alt="card back" className="absolute rounded-sm" style={{ width: '30px', height: '42px', zIndex: 3, top: '0', left: '0' }} />
        <img src={cardBack} alt="card back" className="absolute rounded-sm" style={{ width: '30px', height: '42px', zIndex: 2, top: '0', left: '4px' }} />
        <img src={cardBack} alt="card back" className="absolute rounded-sm" style={{ width: '30px', height: '42px', zIndex: 1, top: '0', left: '8px' }} />
      </div>
      {DealerIcon}
    </div>
  );

  const hue = progress * 1.2;
  const progressBarColor = `hsl(${hue}, 100%, 50%)`;

  return (
    <div className={spotClasses} style={containerStyle}>
      <div className="relative">
        <div className="relative flex justify-center items-start" style={{ width: `${avatarSize}px`, height: `${avatarSize + nameHeight / 1.5}px` }}>
          <div className="relative z-10" style={{ width: `${avatarSize}px`, height: `${avatarSize}px` }}>
            <ActionNotification action={notificationType} visible={!!notificationType && !hasFolded} />
            <div className="absolute rounded-full top-0 left-0" style={{ width: `${avatarSize}px`, height: `${avatarSize}px`, backgroundColor: '#555456' }}></div>
            <div className="absolute rounded-full top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" style={{ width: `${avatarSize - (6 * scale)}px`, height: `${avatarSize - (6 * scale)}px`, backgroundColor: '#ECEBF5' }}></div>
            <div className="absolute rounded-full overflow-hidden top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" style={{ width: `${avatarSize - (10 * scale)}px`, height: `${avatarSize - (10 * scale)}px` }}>
              {avatar ? <img src={avatar} alt={username} className="w-full h-full object-cover" /> : <img src={defaultAvatar} alt={username} className="w-full h-full object-cover" /> }
            </div>
          </div>
          <div className="absolute left-1/2 transform -translate-x-1/2 z-20" style={{ bottom: '-4px' }}>
            <div className="flex flex-col items-center">
              <div className="relative" style={{ width: `${nameWidth}px`, height: `${nameHeight}px` }}>
                <div className="absolute inset-0" style={{ borderRadius: `${8 * scale}px`, background: 'linear-gradient(180deg, #48454D 0%, rgba(255, 255, 255, 0.3) 50%, #2D2B31 100%)' }}></div>
                <div className="absolute flex flex-col items-center justify-center" style={{ top: `${1 * scale}px`, left: `${1 * scale}px`, right: `${1 * scale}px`, bottom: `${1 * scale}px`, borderRadius: `${7 * scale}px`, background: 'linear-gradient(to top, #000000, #36333B)' }}>
                  <div className="font-bold" style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: `${10 * scale}px`, borderBottom: `${1 * scale}px solid rgba(255, 255, 255, 0.07)` }}>
                    {username}
                  </div>
                  <div className="font-bold" style={{ color: '#D2A21B', fontSize: `${10 * scale}px` }}>
                    ${balance}
                  </div>
                </div>
              </div>
              {isTurn && isCurrentUser && (
                <div className="absolute" style={{ bottom: '-10px', left: '50%', transform: 'translateX(-50%)', width: '68px', height: '5px', backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${progress}%`, height: '100%', backgroundColor: progressBarColor, borderRadius: '3px', transition: 'width 0.1s linear, background-color 0.1s linear' }} />
                </div>
              )}
            </div>
          </div>
        </div>
        {(showCards || (isCurrentUser && hasLooked)) && (
          <div className="absolute left-1/2 transform -translate-x-1/2 z-50" style={{ top: `${-50 * scale}px`, width: `${cardWidth}px`, height: `${cardHeight}px` }}>
            <div className="relative w-full h-full">
              {cards.map((card, index) => {
                const centerOffset = (cards.length - 1) * step / 2;
                const left = index * step - centerOffset;
                const rotation = index === 0 ? -12 : index === 1 ? 0 : 12;
                const topOffset = index === 1 ? 0 : 4;
                return (
                  <div key={index} className="absolute" style={{ left: `${left}px`, top: `${topOffset}px`, width: `${cardWidth}px`, height: `${cardHeight}px`, transform: `rotate(${rotation}deg)`, zIndex: index + 1 }}>
                    <CardComponent card={card} hidden={false} customWidth={cardWidth} customHeight={cardHeight} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {!hasFolded && !hasLooked && (
          <div style={cardDeckStyle} className="flex items-center space-x-2">
            {cardSide === 'left' && TotalBetComponent}
            {CardDeckComponent}
            {cardSide === 'right' && TotalBetComponent}
          </div>
        )}
        {getPlayerStatus() && (
          <div className="absolute -top-2 right-0 bg-gray-800 text-white px-2 py-1 rounded-full z-40" style={{ fontSize: `${12 * scale}px` }}>
            {getPlayerStatus()}
          </div>
        )}
        {!isCurrentUser && tableBalance > 0 && !hasFolded && (
          <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 text-white font-semibold text-[10px] leading-none text-center z-40">
            ${tableBalance}
          </div>
        )}
        {score !== undefined && (showCards || (isCurrentUser && hasLooked)) && (
          <div className="absolute z-40 flex items-center justify-center" style={{ left: `${-45 * scale}px`, top: `${-11 * scale}px`, width: `${22 * scale}px`, height: `${22 * scale}px`, backgroundColor: '#FF443A', borderRadius: '50%' }}>
            <span style={{ fontWeight: 500, fontStyle: 'normal', fontSize: `${14 * scale}px`, lineHeight: '100%', letterSpacing: '0%', textAlign: 'center', verticalAlign: 'middle', color: '#FFFFFF' }}>
              {score}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
