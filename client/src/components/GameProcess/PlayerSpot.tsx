import { useState, useEffect, useRef, useMemo } from 'react';
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
  hideCards?: boolean;
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
  showWinIndicator,
  hideCards = false
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
  const cardsSignature = useMemo(() => {
    if (!cardsCount) {
      return '';
    }
    return (cards ?? []).map((card, index) => `${index}-${card.suit}-${card.rank}-${card.value}`).join('|');
  }, [cards, cardsCount]);

  const gameStatus = gameState?.status;
  const canRevealDuringRound = gameStatus === 'blind_betting' || gameStatus === 'betting';
  const canRevealAfterRound = gameStatus === 'showdown' || gameStatus === 'finished';
  const shouldRevealCardFaces = !hideCards && (
    showCards ||
    (isCurrentUser && hasLooked && (canRevealDuringRound || canRevealAfterRound))
  );
  const shouldRenderCardFan = cardsCount > 0 && !hasFolded;
  const useDeckLayout = !shouldRevealCardFaces;
  const deckCardWidth = 28;
  const deckCardHeight = 40;
  const deckCardOffset = 4;
  const deckContainerSize = 42;
  const deckHorizontalOffset = '52px';

  const shouldAnimateFan = useMemo(() => {
    if (hasFolded || !cardsCount) {
      return false;
    }
    if (hideCards) {
      return true;
    }
    if (showCards) {
      return true;
    }
    return isCurrentUser && hasLooked && canRevealDuringRound;
  }, [hasFolded, cardsCount, hideCards, showCards, isCurrentUser, hasLooked, canRevealDuringRound]);
  const spacingMultiplierBase = isCurrentUser ? 0.74 : 0.7;
  const spacingMultiplier = cardsCount > 1
    ? Math.min(0.9, spacingMultiplierBase + Math.max(0, cardsCount - 3) * 0.05)
    : 0;
  const fanStep =
    cardsCount > 1
      ? Math.max(baseFanStep, cardWidth * spacingMultiplier) * 0.55
      : 0;

  const sideGap = 10 * scale;
  const rotationStep =
    cardsCount <= 2 ? 8 : cardsCount === 3 ? 12 : cardsCount === 4 ? 10 : 8;

  const arcStep =
    cardsCount <= 3 ? 2 : cardsCount === 4 ? 3 : 4;
    const fanWidth = cardsCount > 1 ? cardWidth + fanStep * (cardsCount - 1) : cardWidth;
    const fanHeight = cardHeight + arcStep * Math.max(0, cardsCount - 1);
    const fanCenterOffset = cardsCount > 1 ? (fanWidth - cardWidth) / 2 : 0;
    const fanHorizontalOffset = (avatarSize / 2) + (fanWidth / 2) + sideGap;
    const fanVerticalOffset = (avatarSize / 2) + (fanHeight / 2) + sideGap;

    const cardFanOffset = useMemo(() => {
      switch (openCardsPosition) {
        case 'bottom':
          return { x: 0, y: fanVerticalOffset };
        case 'left':
          return { x: -fanHorizontalOffset, y: 0 };
        case 'right':
          return { x: fanHorizontalOffset, y: 0 };
        default:
          return { x: 0, y: -fanVerticalOffset };
      }
    }, [openCardsPosition, fanHorizontalOffset, fanVerticalOffset]);

    const cardFanWrapperStyle: React.CSSProperties = {
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: `${fanWidth}px`,
      height: `${fanHeight}px`,
      transform: `translate(-50%, -50%) translate(${cardFanOffset.x}px, ${cardFanOffset.y}px)`,
      zIndex: 50,
    };

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
    cardDeckStyle.right = deckHorizontalOffset;
  } else {
    cardDeckStyle.left = deckHorizontalOffset;
  }

  const hiddenCardStackStyle: React.CSSProperties = {
    position: 'absolute',
    top: '45%',
    transform: 'translateY(-50%)',
    zIndex: 50,
    pointerEvents: 'none',
    width: `${deckContainerSize}px`,
    height: `${deckContainerSize}px`,
    ...(cardSide === 'left' ? { right: deckHorizontalOffset } : { left: deckHorizontalOffset }),
  };

  const badgeSize = Math.round(22 * scale);
 const scoreBadgeBaseStyle: React.CSSProperties = {
  width: `${badgeSize}px`,
  height: `${badgeSize}px`,
  backgroundColor: '#FF443A',
  borderRadius: '50%',
  display: 'block',
  border: '0.5px solid rgba(101, 101, 101, 0.91)',
  boxShadow: '0px 4px 10px rgba(0,0,0,.35)',
};

  const DEAL_DURATION_MS = 900;   // длительность перелёта одной карты
  const DEAL_STAGGER_MS  = 250;   // задержка между картами
  const DEAL_EASE        = 'cubic-bezier(0.22, 0.61, 0.36, 1)';

  type FlyingCard = {
  id: string;                // уникальный ключ
  left: number;              // стартовая позиция (центр колоды)
  top: number;
  width: number;
  height: number;
  rotate: number;            // конечный угол
  dx: number;                // смещение до цели
  dy: number;
  delay: number;
};


  const [flying, setFlying] = useState<FlyingCard[]>([]);
  const [fanVisible, setFanVisible] = useState(false); // включаем настоящий веер, когда всё долетело

// рефы
  const cardElsRef = useRef<Array<HTMLDivElement | null>>([]);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const dealerRef = useRef<HTMLDivElement | null>(null);

  const animationFrameRef = useRef<number | null>(null);
  const animationTimerRef = useRef<number | null>(null);
  const animationRunningRef = useRef(false);
  const lastAnimationSignatureRef = useRef<string | null>(null);

  const scoreBadgePositionStyle: React.CSSProperties = (() => {
    let style: React.CSSProperties = { bottom: `${-badgeSize * 0.35}px`, left: `${-badgeSize * 0.35}px` };

    if (openCardsPosition === 'top') {
      // ещё левее: увеличим k и добавим небольшой dx
      const k = 0.80;           // было 0.60
      const dx = 3 * scale;     // тонкая подстройка в пикселях
      style = {
        top: `${-10 * scale + fanHeight * 0.40}px`,
        left: `calc(50% - ${fanWidth / 2 + badgeSize * k + dx}px)`,
        transform: 'none',
      };
    }
    return style;
  })();

useEffect(() => {
  if (!shouldAnimateFan) {
    animationRunningRef.current = false;
    lastAnimationSignatureRef.current = null;
    setFanVisible(true);
    setFlying(prev => (prev.length ? [] : prev));
    if (animationTimerRef.current) {
      clearTimeout(animationTimerRef.current);
      animationTimerRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    return;
  }

  if (!dealerRef.current || !cardsCount || !cardsSignature) {
    return;
  }

  if (lastAnimationSignatureRef.current === cardsSignature && animationRunningRef.current) {
    return;
  }

  animationRunningRef.current = true;
  lastAnimationSignatureRef.current = cardsSignature;

  if (animationTimerRef.current) {
    clearTimeout(animationTimerRef.current);
    animationTimerRef.current = null;
  }
  if (animationFrameRef.current) {
    cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
  }

  const beginAnimation = () => {
    if (!dealerRef.current) {
      animationRunningRef.current = false;
      lastAnimationSignatureRef.current = null;
      setFanVisible(true);
      return;
    }

    const deckRect = dealerRef.current.getBoundingClientRect();
    const startX = deckRect.left + deckRect.width / 2;
    const startY = deckRect.top + deckRect.height / 2;
    const timestamp = Date.now();

    const clones = cardElsRef.current.slice(0, cardsCount).map((el, index) => {
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const rotationAttr = el.dataset.cardRotation;
      const delayAttr = el.dataset.cardDelay;
      return {
        id: `${player.id}-${timestamp}-${index}`,
        left: startX,
        top: startY,
        width: rect.width,
        height: rect.height,
        rotate: rotationAttr ? Number(rotationAttr) : 0,
        dx: rect.left + rect.width / 2 - startX,
        dy: rect.top + rect.height / 2 - startY,
        delay: delayAttr ? Number(delayAttr) : index * DEAL_STAGGER_MS,
      };
    }).filter(Boolean) as FlyingCard[];

    if (!clones.length) {
      setFanVisible(true);
      animationRunningRef.current = false;
      lastAnimationSignatureRef.current = null;
      return;
    }

    setFanVisible(false);
    setFlying(clones);

    const totalDuration = DEAL_DURATION_MS + DEAL_STAGGER_MS * (clones.length - 1);
    animationTimerRef.current = window.setTimeout(() => {
      setFanVisible(true);
      setFlying(prev => (prev.length ? [] : prev));
      animationRunningRef.current = false;
      lastAnimationSignatureRef.current = null;
      animationTimerRef.current = null;
    }, totalDuration + 50);
  };

  animationFrameRef.current = requestAnimationFrame(beginAnimation);

  return () => {
    if (animationTimerRef.current) {
      clearTimeout(animationTimerRef.current);
      animationTimerRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };
}, [shouldAnimateFan, cardsSignature, cardsCount, rotationStep, player.id]);

  useEffect(() => {
    cardElsRef.current = cardElsRef.current.slice(0, cardsCount);
  }, [cardsCount]);



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
   <div className="flex flex-col items-center space-y-1" ref={dealerRef}>
     <div className="relative" style={{ width: '42px', height: '42px' }}>
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
      <ActionNotification
        action={notificationType}
        visible={!!notificationType && (notificationType === 'pass' || !hasFolded)}
        maxWidth={nameWidth}   // <- ограничение по ширине блока имени/баланса
        scale={scale}          // <- для размеров шрифта/высоты
      />
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
        {shouldRenderCardFan && (
          <>
            {flying.length > 0 && (
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  pointerEvents: 'none',
                  zIndex: 9999, // ??????????: ?????????
                }}
              >
                {flying.map(fc => (
                  <div
                    key={fc.id}
                    style={{
                      position: 'absolute',
                      left: fc.left - fc.width / 2,
                      top: fc.top - fc.height / 2,
                      width: fc.width,
                      height: fc.height,
                      transform: 'translate(0px, 0px) rotate(0deg)',
                      transition: `transform ${DEAL_DURATION_MS}ms ${DEAL_EASE} ${fc.delay}ms`,
                      willChange: 'transform',
                    }}
                    ref={(el) => {
                      if (!el) return;
                      requestAnimationFrame(() => {
                        void el.offsetHeight;
                        el.style.transform = `translate(${fc.dx}px, ${fc.dy}px) rotate(${fc.rotate}deg)`;
                      });
                    }}
                    onTransitionEnd={() => {
                      // ???????>???????? ??????????????? ???? ??????<??????' ??>???? ??" ????'?? ??????: ???? ?'??????????? ??????
                    }}
                  >
                    <img
                      src={cardBack}
                      alt=""
                      style={{ width: '100%', height: '100%', borderRadius: 4, display: 'block' }}
                    />
                  </div>
                ))}
              </div>
            )}
            {useDeckLayout ? (
              <div className="absolute" style={hiddenCardStackStyle}>
                <div
                  className="relative w-full h-full"
                  style={{ visibility: hideCards || !fanVisible ? 'hidden' : 'visible' }}
                  data-player-card-container={player.id}
                >
                  {cards.map((card, index) => {
                    const offsetX = deckCardOffset * index;
                    return (
                      <div
                        key={index}
                        className="absolute"
                        ref={(el) => { cardElsRef.current[index] = el; }}
                        style={{
                          left: `${offsetX}px`,
                          top: '0px',
                          width: `${deckCardWidth}px`,
                          height: `${deckCardHeight}px`,
                          transform: 'rotate(0deg)',
                          transformOrigin: '50% 50%',
                          zIndex: 10 + index,
                        }}
                        data-player-card={`${player.id}-${index}`}
                        data-card-rotation={0}
                        data-card-zindex={10 + index}
                        data-card-transform-origin="50% 50%"
                        data-card-delay={index * DEAL_STAGGER_MS}
                      >
                        <CardComponent
                          card={card}
                          hidden={!shouldRevealCardFaces}
                          customWidth={deckCardWidth}
                          customHeight={deckCardHeight}
                        />
                      </div>
                    );
                  })}
                </div>
                <div
                  data-player-card-slot={player.id}
                  ref={anchorRef}
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: '1px',
                    height: '1px',
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'none',
                    zIndex: 49, // ?????? ????????: ??????' ???????? (????'?????<?? ?? ?'??+?? z= index+1 / 50+)
                  }}
                />
              </div>
            ) : (
              <div className="absolute z-50" style={cardFanWrapperStyle}>
                <div
                  className="relative w-full h-full"
                  style={{ visibility: hideCards || !fanVisible ? 'hidden' : 'visible' }}
                  data-player-card-container={player.id}
                >
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
                        ref={(el) => { cardElsRef.current[index] = el; }}
                        style={{
                          left: `${left}px`,
                          top: `${topOffset}px`,
                          width: `${cardWidth}px`,
                          height: `${cardHeight}px`,
                          transform: `rotate(${rotation}deg)`,
                          transformOrigin: '50% 80%',
                          zIndex: index + 1,
                        }}
                        data-player-card={`${player.id}-${index}`}
                        data-card-rotation={rotation}
                        data-card-zindex={index + 1}
                        data-card-transform-origin="50% 80%"
                        data-card-delay={index * DEAL_STAGGER_MS}
                      >
                        <CardComponent card={card} hidden={!shouldRevealCardFaces} customWidth={cardWidth} customHeight={cardHeight} />
                      </div>
                    );
                  })}
                </div>
                <div
                  data-player-card-slot={player.id}
                  ref={anchorRef}
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: '1px',
                    height: '1px',
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'none',
                    zIndex: 49, // ?????? ????????: ??????' ???????? (????'?????<?? ?? ?'??+?? z= index+1 / 50+)
                  }}
                />
              </div>
            )}
          </>
        )}
        {!hasFolded && (
          <div style={cardDeckStyle} className="flex items-center space-x-2">
            {cardSide === 'left' && !isCurrentUser && TotalBetComponent}
            <div style={{ visibility: flying.length > 0 ? 'visible' : ((isCurrentUser && hasLooked) ? 'hidden' : 'visible') }}>
              {CardDeckComponent}
            </div>
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
    className="absolute"
    style={{
      ...scoreBadgeBaseStyle,
      ...scoreBadgePositionStyle,
      zIndex: 60,
      pointerEvents: 'none',
    }}
  >
    {/* ТЕКСТ СВЕРХУ КРУГА — идеальный центр */}
    <svg
      viewBox="0 0 100 100"
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0, display: 'block' }}
    >
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="middle"
        dy="0.08em"
        fontWeight={700}
        fontSize={62}         // ~0.62 от viewBox; можно 60–64
        fill="#FFFFFF"
        style={{ fontVariantNumeric: 'tabular-nums lining-nums' }}
      >
        {score}
      </text>
    </svg>
  </div>
        )}
      </div>
    </div>
  );
}
