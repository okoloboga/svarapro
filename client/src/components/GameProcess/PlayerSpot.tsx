import { useState, useEffect } from 'react';
import { Player } from '@/types/game';
import { CardComponent } from './CardComponent';
import { ActionNotification } from './ActionNotification';
import defaultAvatar from '@/assets/main_logo.png';
import cardBack from '@/assets/game/back.png';
import chatButtonBg from '@/assets/game/chat.png';
import { TURN_DURATION_SECONDS } from '@/constants';

const formatAmount = (amount: number): string => {
  const num = Number(amount);
  const fixed = num.toFixed(2);
  if (fixed.endsWith('.00')) {
    return String(Math.round(num));
  }
  if (fixed.endsWith('0')) {
    return fixed.slice(0, -1);
  }
  return fixed;
};

const formatUsername = (username: string): string => {
  if (username.length <= 11) {
    return username;
  }
  return username.slice(0, 8) + '...';
};

interface PlayerSpotProps {
  player: Player;
  isCurrentUser: boolean;
  showCards: boolean;
  scale?: number;
  cardSide?: 'left' | 'right';
  openCardsPosition?: 'top' | 'bottom' | 'left' | 'right';
  isTurn?: boolean;
  turnTimer?: number;
  winAmount?: number;
  chatPhrase?: string;
  onPlayerBet?: (playerId: string) => void;
  gameState?: { 
    log: Array<{ 
      telegramId: string; 
      amount?: number; 
      timestamp: number;
      type?: string;
    }>;
    winners?: Array<{ id: string; username?: string; position?: number }>;
    status?: string;
    lastActionAmount?: number;
    currentBet?: number;
  };
  notificationType: 'blind' | 'paid' | 'pass' | 'rais' | 'win' | 'look' | null;
  showWinIndicator: boolean;
}

export function PlayerSpot({ 
  player, 
  isCurrentUser, 
  showCards, 
  scale = 1, 
  cardSide = 'right', 
  openCardsPosition = 'top', 
  isTurn = false, 
  turnTimer = TURN_DURATION_SECONDS, 
  winAmount = 0, 
  chatPhrase, 
  onPlayerBet, 
  gameState,
  notificationType,
  showWinIndicator
}: PlayerSpotProps) {
  
  const { username, avatar, balance, cards, hasFolded, hasLooked, score } = player;
  const [lastTotalBet, setLastTotalBet] = useState(player.totalBet);

  const buttonTextStyle: React.CSSProperties = {
    fontWeight: 700,
    fontSize: '9px',
    lineHeight: '100%',
    textAlign: 'center',
    color: 'black',
  };

  // Функция для вычисления суммы последнего действия игрока
  // const getLastActionAmount = () => {
  //   if (!gameState?.log) return 0;
  //   
  //   if (gameState.status === 'betting') {
  //     if (gameState.lastActionAmount && gameState.lastActionAmount > 0) {
  //       return gameState.lastActionAmount;
  //     }
  //     
  //     const currentPlayerBet = player.currentBet || 0;
  //     const gameStateCurrentBet = gameState.currentBet || 0;
  //     return Math.max(0, gameStateCurrentBet - currentPlayerBet);
  //   }
  //   
  //   const playerActions = gameState.log
  //     .filter((action) => action.telegramId === player.id)
  //     .sort((a, b) => b.timestamp - a.timestamp);
  //   
  //   if (playerActions.length === 0) return 0;
  //   
  //   const lastAction = playerActions[0];
  //   const amount = lastAction.amount || 0;
  //   
  //   return amount;
  // };

  const progress = (turnTimer / TURN_DURATION_SECONDS) * 100;

  // Отслеживание изменений ставок для анимации фишек
  useEffect(() => {
    // Временно отключена автоматическая анимация - она запускается только через обработчики действий
    // if (player.totalBet > lastTotalBet && onPlayerBet) {
    //   onPlayerBet(player.id);
    // }
    setLastTotalBet(player.totalBet);
  }, [player.totalBet, lastTotalBet, player.id, onPlayerBet]);

  const baseAvatarSize = 62;
  const baseNameWidth = 70;
  const baseNameHeight = 32;
  
  const avatarSize = baseAvatarSize * scale;
  const nameWidth = baseNameWidth * scale;
  const nameHeight = baseNameHeight * scale;

  // Размеры карт для текущего пользователя (больше)
  const currentUserCardHeight = Math.round(avatarSize * 1.05);
  const currentUserCardWidth = Math.round(currentUserCardHeight * (65/90));
  const currentUserStep = Math.round(currentUserCardWidth * 0.7);
  
  // Размеры карт для других игроков (меньше)
  const otherPlayersCardHeight = Math.round(avatarSize * 0.9);
  const otherPlayersCardWidth = Math.round(otherPlayersCardHeight * (65/90));
  const otherPlayersStep = Math.round(otherPlayersCardWidth * 0.7);
  
  // Выбираем размеры в зависимости от того, текущий ли это пользователь
  const cardHeight = isCurrentUser ? currentUserCardHeight : otherPlayersCardHeight;
  const cardWidth = isCurrentUser ? currentUserCardWidth : otherPlayersCardWidth;
  const baseFanStep = isCurrentUser ? currentUserStep : otherPlayersStep;
  const cardsCount = cards?.length ?? 0;
  const spacingMultiplierBase = isCurrentUser ? 0.74 : 0.7;
  const spacingMultiplier = cardsCount > 1
    ? Math.min(0.9, spacingMultiplierBase + Math.max(0, cardsCount - 3) * 0.05)
    : 0;
  const fanStep =
    cardsCount > 1
      ? Math.max(baseFanStep, cardWidth * spacingMultiplier) * 0.55
      : 0;

  const rotationStep =
    cardsCount <= 2 ? 8 : cardsCount === 3 ? 12 : cardsCount === 4 ? 10 : 8;

  const arcStep =
    cardsCount <= 3 ? 2 : cardsCount === 4 ? 3 : 4;
    const fanWidth = cardsCount > 1 ? cardWidth + fanStep * (cardsCount - 1) : cardWidth;
    const fanHeight = cardHeight + arcStep * Math.max(0, cardsCount - 1);
    const fanCenterOffset = cardsCount > 1 ? (fanWidth - cardWidth) / 2 : 0;

  const spotClasses = `
    relative rounded-lg p-3 flex items-center
    ${hasFolded ? 'opacity-60' : ''}
    ${!player.isActive && !player.hasFolded ? 'opacity-70' : ''}
  `;

  const containerStyle: React.CSSProperties = {
    transform: `scale(${scale})`,
    transformOrigin: 'center center',
  };

  const cardDeckStyle: React.CSSProperties = {
    position: 'absolute',
    top: '45%',
    transform: 'translateY(-50%)',
    zIndex: 30,
  };

  if (cardSide === 'left') {
    cardDeckStyle.right = '52px';
  } else {
    cardDeckStyle.left = '52px';
  }

  const badgeSize = 22 * scale;
  const scoreBadgeBaseStyle: React.CSSProperties = {
    width: `${badgeSize}px`,
    height: `${badgeSize}px`,
    backgroundColor: '#FF443A',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '0.5px solid rgba(101, 101, 101, 0.91)',
    boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.35)',
  };

  const scoreBadgePositionStyle: React.CSSProperties = (() => {
  let style: React.CSSProperties = { bottom: `${-badgeSize * 0.35}px`, left: `${-badgeSize * 0.35}px` };

  if (openCardsPosition === 'top') {
    const k = 0.60; 
    style = {
      top: `${-10 * scale + fanHeight * 0.40}px`,
      left: `calc(50% - ${fanWidth / 2 + badgeSize * k}px)`,
      transform: 'none',
    };
  }

  return style;
})();

  const TotalBetComponent = player.totalBet > 0 && !showCards && (
    <div 
      className="text-white font-semibold text-xs leading-4 flex items-center justify-center px-2"
      style={{
        minWidth: '32px',
        height: '19px',
        borderRadius: '8px',
        backgroundColor: 'rgba(35, 34, 40, 0.61)',
      }}
    >
      {`$${formatAmount(player.totalBet)}`}
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
      <div className="relative" data-player-card-slot={player.id} style={{ width: '42px', height: '42px' }}>
        <img src={cardBack} alt="card back" className="absolute rounded-sm" style={{ width: '28px', height: '40px', zIndex: 3, top: '0', left: '0' }} />
        <img src={cardBack} alt="card back" className="absolute rounded-sm" style={{ width: '28px', height: '40px', zIndex: 2, top: '0', left: '4px' }} />
        <img src={cardBack} alt="card back" className="absolute rounded-sm" style={{ width: '28px', height: '40px', zIndex: 1, top: '0', left: '8px' }} />
      </div>
    </div>
  );

  const hue = progress * 1.2;
  const progressBarColor = `hsl(${hue}, 100%, 50%)`;

  // Render a placeholder for players waiting for the next round
  if (!player.isActive && !player.hasFolded) {
    return (
      <div className={`${spotClasses} player-spot`} style={containerStyle}>
        <div className="relative">
          <div className="relative flex justify-center items-start" style={{ width: `${avatarSize}px`, height: `${avatarSize + nameHeight / 1.5}px` }}>
            <div className="relative z-10" style={{ width: `${avatarSize}px`, height: `${avatarSize}px` }}>
              <div 
                className="absolute rounded-full top-0 left-0"
                style={{ 
                  width: `${avatarSize}px`, 
                  height: `${avatarSize}px`, 
                  backgroundColor: '#555456',
                }}
              ></div>
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
                      {formatUsername(username)}
                    </div>
                    <div className="font-bold" style={{ color: '#D2A21B', fontSize: `${10 * scale}px` }}>
                      {`$${formatAmount(balance)}`}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${spotClasses} player-spot`} style={containerStyle}>
      {chatPhrase && (
        <div 
          className="absolute left-1/2 -translate-x-1/2 z-50 flex items-center justify-center p-1"
          style={{
            width: '75px',
            height: '38px',
            bottom: '80%', // Positioned above the avatar 
            paddingBottom: '13px',
            backgroundImage: `url(${chatButtonBg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            ...buttonTextStyle
          }}
        >
          {chatPhrase}
        </div>
      )}
      <ActionNotification action={notificationType} visible={!!notificationType && (notificationType === 'pass' || !hasFolded)} />
      <div className="relative">
        <div className="relative flex justify-center items-start" style={{ width: `${avatarSize}px`, height: `${avatarSize + nameHeight / 1.5}px` }}>
          <div className="relative z-10" style={{ width: `${avatarSize}px`, height: `${avatarSize}px` }}>
            
            {/* Win amount container */}
            {showWinIndicator && (
              <div 
                className="absolute left-1/2 z-30 flex items-center justify-center transition-opacity duration-500"
                style={{ 
                  bottom: `${-nameHeight * 0.25}px`,
                  transform: 'translate(-50%, 100%)',
                  minWidth: `${68 * scale}px`, 
                  height: `${20 * scale}px`,
                  borderRadius: `${14 * scale}px`,
                  background: '#212027',
                  boxShadow: '0px 0px 4px 2px #EC8800',
                  zIndex: 50
                }}
              >
                <span style={{
                  fontWeight: 600,
                  fontStyle: 'normal',
                  fontSize: `${12 * scale}px`,
                  lineHeight: '100%',
                  letterSpacing: '0%',
                  textAlign: 'center',
                  verticalAlign: 'middle',
                  color: '#D2A21B'
                }}>
                  {`+$${formatAmount(winAmount)}`}
                </span>
              </div>
            )}
            
            {/* Avatar with win animation shadow */}
            <div 
              className="absolute rounded-full top-0 left-0 transition-all duration-500" 
              style={{ 
                width: `${avatarSize}px`, 
                height: `${avatarSize}px`, 
                backgroundColor: '#555456',
                boxShadow: showWinIndicator 
                  ? '0px 0px 4px 2px #EC8800' 
                  : isTurn 
                    ? '0px 0px 8px 4px #56BF00' 
                    : 'none'
              }}
            ></div>
            <div className="absolute rounded-full top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" style={{ width: `${avatarSize - (6 * scale)}px`, height: `${avatarSize - (6 * scale)}px`, backgroundColor: '#ECEBF5' }}></div>
            <div className="absolute rounded-full overflow-hidden top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" style={{ width: `${avatarSize - (10 * scale)}px`, height: `${avatarSize - (10 * scale)}px` }}>
              {avatar ? <img src={avatar} alt={username} className="w-full h-full object-cover" /> : <img src={defaultAvatar} alt={username} className="w-full h-full object-cover" /> }
            </div>
            
            {/* Total bet for current user - positioned above avatar */}
            {isCurrentUser && TotalBetComponent && (
              <div 
                className="absolute left-1/2 transform -translate-x-1/2 flex items-center justify-center"
                style={{ 
                  top: `${-25 * scale}px`,
                  zIndex: 30
                }}
              >
                {TotalBetComponent}
              </div>
            )}

          </div>
          <div className="absolute left-1/2 transform -translate-x-1/2 z-20" style={{ bottom: '-4px' }}>
            <div className="flex flex-col items-center">
              <div className="relative" style={{ width: `${nameWidth}px`, height: `${nameHeight}px` }}>
                <div className="absolute inset-0" style={{ borderRadius: `${8 * scale}px`, background: 'linear-gradient(180deg, #48454D 0%, rgba(255, 255, 255, 0.3) 50%, #2D2B31 100%)' }}></div>
                <div className="absolute flex flex-col items-center justify-center" style={{ top: `${1 * scale}px`, left: `${1 * scale}px`, right: `${1 * scale}px`, bottom: `${1 * scale}px`, borderRadius: `${7 * scale}px`, background: 'linear-gradient(to top, #000000, #36333B)' }}>
                  <div className="font-bold" style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: `${10 * scale}px`, borderBottom: `${1 * scale}px solid rgba(255, 255, 255, 0.07)` }}>
                    {formatUsername(username)}
                  </div>
                  <div className="font-bold" style={{ color: '#D2A21B', fontSize: `${10 * scale}px` }}>
                    {`$${formatAmount(balance)}`}
                  </div>
                </div>
                
                {/* Dealer Icon - позиционируется слева или справа от блока с именем и балансом */}
                {DealerIcon && (
                  <div className="absolute" style={{ 
                    top: '50%',
                    transform: 'translateY(-50%)',
                    [cardSide === 'left' ? 'left' : 'right']: `${-20 * scale}px`,
                    zIndex: 25
                  }}>
                    {DealerIcon}
                  </div>
                )}
              </div>
              {isTurn && (
                <div className="absolute" style={{ bottom: '-10px', left: '50%', transform: 'translateX(-50%)', width: '68px', height: '5px', backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${progress}%`, height: '100%', backgroundColor: progressBarColor, borderRadius: '3px', transition: 'width 0.1s linear, background-color 0.1s linear' }} />
                </div>
              )}
            </div>
          </div>
        </div>
        {(
          !hasFolded && (showCards || (isCurrentUser && hasLooked && (gameState?.status === 'blind_betting' || gameState?.status === 'betting')))
        ) && (
          <div className="absolute z-50" style={{ 
            width: `${fanWidth}px`, 
            height: `${fanHeight}px`,
            ...(openCardsPosition === 'top' && {
              left: '50%',
              transform: 'translateX(-50%)',
              top: `${-10 * scale}px`
            }),
            ...(openCardsPosition === 'bottom' && {
              left: '50%',
              transform: 'translateX(-50%)',
              top: `${40 * scale}px`
            }),
            ...(openCardsPosition === 'left' && {
              right: `${112 * scale}px`,
              top: '40%',
              transform: 'translateY(-50%)'
            }),
            ...(openCardsPosition === 'right' && {
              left: `${112 * scale}px`,
              top: '40%',
              transform: 'translateY(-50%)'
            })
          }}>
            <div className="relative w-full h-full">
              {cards.map((card, index) => {
                const midIndex = (cards.length - 1) / 2;
                const offsetIndex = index - midIndex;
                const depthFactor = Math.pow(Math.abs(offsetIndex), 1.25);
                const left = fanCenterOffset + offsetIndex * fanStep;
                const rotation = offsetIndex * rotationStep;
                const topOffset = depthFactor * arcStep;
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
                      transformOrigin: '50% 85%',
                      zIndex: index + 1,
                    }}
                  >
                    <CardComponent card={card} hidden={false} customWidth={cardWidth} customHeight={cardHeight} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {!hasFolded && (
          <div style={cardDeckStyle} className="flex items-center space-x-2">
            {cardSide === 'left' && !isCurrentUser && TotalBetComponent}
            {!(isCurrentUser && hasLooked) && gameState?.status !== 'finished' && gameState?.status !== 'waiting' && gameState?.status !== 'ante' && gameState?.status !== 'showdown' && CardDeckComponent}
            {cardSide === 'right' && !isCurrentUser && TotalBetComponent}
          </div>
        )}

        {/* {(() => {
          // For other players, show last action amount
          if (!isCurrentUser) {
            const lastActionAmount = getLastActionAmount();
            const shouldShow = lastActionAmount > 0 && !hasFolded;
            return shouldShow ? (
              <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-white font-semibold text-[10px] leading-none text-center z-40">
                {`$${formatAmount(lastActionAmount)}`}
              </div>
            ) : null;
          }

          // For the current user, total bet is now shown above avatar
          return null;
        })()} */}
        {score !== undefined && !hasFolded && ((gameState?.status === 'showdown') || (gameState?.status !== 'finished' && (isCurrentUser && hasLooked)) || (gameState?.status === 'finished' && showCards)) && (
          <div
            className="absolute z-50 flex items-center justify-start"
            style={{
              ...scoreBadgeBaseStyle,
              ...scoreBadgePositionStyle,
            }}
          >
            <span
              style={{
                fontWeight: 600,
                fontStyle: 'normal',
                fontSize: `${13 * scale}px`,
                lineHeight: '100%',
                letterSpacing: '0.01em',
                textAlign: 'center',
                color: '#FFFFFF',
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
