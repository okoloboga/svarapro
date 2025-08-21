import { useState, useEffect } from 'react';
import { Player } from '@/types/game';
import { CardComponent } from './CardComponent';
import { ActionNotification } from './ActionNotification';
import defaultAvatar from '@/assets/main_logo.png';
import cardBack from '@/assets/game/back.png';
import chatButtonBg from '@/assets/game/chat.png';
import { TURN_DURATION_SECONDS } from '@/constants';

interface PlayerSpotProps {
  player: Player;
  isCurrentUser: boolean;
  showCards: boolean;
  scale?: number;
  cardSide?: 'left' | 'right';
  openCardsPosition?: 'top' | 'bottom' | 'left' | 'right';
  isTurn?: boolean;
  turnTimer?: number;
  isWinner?: boolean;
  winAmount?: number;
  gameStatus?: string;
  chatPhrase?: string;
  onPlayerBet?: (playerId: string) => void;
  gameState?: { 
    log: Array<{ 
      telegramId: string; 
      amount?: number; 
      timestamp: number;
      type?: string;
    }>;
    winners?: Array<{ id: string; username?: string; position?: number }>; // Типизируем winners
    status?: string; // Добавляем status для определения фазы игры
    lastActionAmount?: number; // Добавляем lastActionAmount для корректного расчета call
    currentBet?: number; // Добавляем currentBet для расчета разности ставок
  }; // Добавляем gameState для доступа к логу действий
}

export function PlayerSpot({ player, isCurrentUser, showCards, scale = 1, cardSide = 'right', openCardsPosition = 'top', isTurn = false, turnTimer = TURN_DURATION_SECONDS, isWinner = false, winAmount = 0, gameStatus, chatPhrase, onPlayerBet, gameState }: PlayerSpotProps) {
  const { username, avatar, balance, cards, hasFolded, hasLooked, lastAction, score } = player;
  const [notificationType, setNotificationType] = useState<'blind' | 'paid' | 'pass' | 'rais' | 'win' | 'look' | null>(null);
  const [showWinAnimation, setShowWinAnimation] = useState(false);
  const [showCardsPhase, setShowCardsPhase] = useState(false);
  const [lastTotalBet, setLastTotalBet] = useState(player.totalBet);

  const buttonTextStyle: React.CSSProperties = {
    fontWeight: 700,
    fontSize: '9px',
    lineHeight: '100%',
    textAlign: 'center',
    color: 'black',
    textShadow: '0px 0.5px 1px rgba(255, 255, 255, 0.5)',
  };

  const buttonTextStyle: React.CSSProperties = {
    fontWeight: 700,
    fontSize: '9px',
    lineHeight: '100%',
    textAlign: 'center',
    color: 'white',
    textShadow: '0px 1px 1px rgba(0, 0, 0, 0.5)',
  };

  // Функция для вычисления суммы последнего действия игрока
  const getLastActionAmount = () => {
    if (!gameState?.log) return 0;
    
    // В фазе betting используем ту же логику, что и в GameRoom
    if (gameState.status === 'betting') {
      // Используем lastActionAmount из gameState, если он есть
      if (gameState.lastActionAmount && gameState.lastActionAmount > 0) {
        return gameState.lastActionAmount;
      }
      
      // Иначе вычисляем как разность между currentBet и currentBet игрока
      const currentPlayerBet = player.currentBet || 0;
      const gameStateCurrentBet = gameState.currentBet || 0;
      return Math.max(0, gameStateCurrentBet - currentPlayerBet);
    }
    
    // Для других фаз показываем последнее действие этого игрока
    const playerActions = gameState.log
      .filter((action) => action.telegramId === player.id)
      .sort((a, b) => b.timestamp - a.timestamp);
    
    if (playerActions.length === 0) return 0;
    
    const lastAction = playerActions[0];
    const amount = lastAction.amount || 0;
    
    return amount;
  };

  // Set notification type based on last action
  useEffect(() => {
    if (lastAction && !isCurrentUser) {
      let actionType: 'blind' | 'paid' | 'pass' | 'rais' | 'win' | 'look' | null = null;
      switch (lastAction) {
        case 'blind': actionType = 'blind'; break;
        case 'call': actionType = 'paid'; break;
        case 'fold': actionType = 'pass'; break;
        case 'raise': actionType = 'rais'; break;
        case 'look': actionType = 'look'; break;
        default: actionType = null;
      }
      setNotificationType(actionType);
    } else if (!lastAction || isCurrentUser) {
        setNotificationType(null);
    }
  }, [lastAction, isCurrentUser]);

  // Show WIN notification at the end of the game for winners (non-current user)
  useEffect(() => {
    const shouldShowWinNotification =
      !isCurrentUser &&
      isWinner &&
      winAmount > 0 &&
      (gameStatus === 'finished');

    if (shouldShowWinNotification) {
      setNotificationType('win');
    }
  }, [isCurrentUser, isWinner, winAmount, gameStatus]);

  const progress = (turnTimer / TURN_DURATION_SECONDS) * 100;

  // Win sequence logic: first show cards for 3 seconds, then show win animation
  useEffect(() => {
    const shouldStartSequence = isWinner && winAmount > 0 && gameStatus === 'finished';
    
    if (shouldStartSequence) {
      // Phase 1: Show cards for 3 seconds
      setShowCardsPhase(true);
      setShowWinAnimation(false);
      
      const cardsTimer = setTimeout(() => {
        // Phase 2: Hide cards and show win animation
        setShowCardsPhase(false);
        setShowWinAnimation(true);
        
        // Hide win animation after 2 seconds
        const winTimer = setTimeout(() => {
          setShowWinAnimation(false);
        }, 2000);
        
        return () => clearTimeout(winTimer);
      }, 3000);
      
      return () => clearTimeout(cardsTimer);
    } else {
      setShowCardsPhase(false);
      setShowWinAnimation(false);
    }
  }, [isWinner, winAmount, gameStatus]);

  // Отслеживание изменений ставок для анимации фишек
  useEffect(() => {
    // Временно отключена анимация полета фишек
    // if (player.totalBet > lastTotalBet && onPlayerBet) {
    //   onPlayerBet(player.id);
    // }
    setLastTotalBet(player.totalBet);
  }, [player.totalBet, lastTotalBet, player.id, onPlayerBet]);

  const baseAvatarSize = 71;
  const baseNameWidth = 70;
  const baseNameHeight = 32;
  
  const avatarSize = baseAvatarSize * scale;
  const nameWidth = baseNameWidth * scale;
  const nameHeight = baseNameHeight * scale;

  // Размеры карт для текущего пользователя (больше)
  const currentUserCardHeight = Math.round(avatarSize * 1.2);
  const currentUserCardWidth = Math.round(currentUserCardHeight * (65/90));
  const currentUserStep = Math.round(currentUserCardWidth * 0.46);
  
  // Размеры карт для других игроков (меньше)
  const otherPlayersCardHeight = Math.round(avatarSize);
  const otherPlayersCardWidth = Math.round(otherPlayersCardHeight * (65/90));
  const otherPlayersStep = Math.round(otherPlayersCardWidth * 0.46);
  
  // Выбираем размеры в зависимости от того, текущий ли это пользователь
  const cardHeight = isCurrentUser ? currentUserCardHeight : otherPlayersCardHeight;
  const cardWidth = isCurrentUser ? currentUserCardWidth : otherPlayersCardWidth;
  const step = isCurrentUser ? currentUserStep : otherPlayersStep;

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
    top: '40%',
    transform: 'translateY(-50%)',
    zIndex: 30,
  };

  if (cardSide === 'left') {
    cardDeckStyle.right = '50px';
  } else {
    cardDeckStyle.left = '50px';
  }

  const TotalBetComponent = !isCurrentUser && player.totalBet > 0 && !showCards && (
    <div 
      className="text-white font-semibold text-xs leading-4 flex items-center justify-center"
      style={{
        width: '34px',
        height: '19px',
        borderRadius: '8px',
        backgroundColor: 'rgba(35, 34, 40, 0.61)',
      }}
    >
      ${Number(player.totalBet).toFixed(2)}
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
    </div>
  );

  const hue = progress * 1.2;
  const progressBarColor = `hsl(${hue}, 100%, 50%)`;

  // Render a placeholder for players waiting for the next round
  if (!player.isActive && !player.hasFolded) {
    return (
      <div className={spotClasses} style={containerStyle}>
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
                      {username}
                    </div>
                    <div className="font-bold" style={{ color: '#D2A21B', fontSize: `${10 * scale}px` }}>
                      ${Number(balance).toFixed(2)}
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
    <div className={spotClasses} style={containerStyle}>
      {chatPhrase && (
        <div 
          className="absolute left-1/2 -translate-x-1/2 z-50 flex items-center justify-center p-1"
          style={{
            width: '75px',
            height: '38px',
            bottom: '105%', // Positioned above the avatar
            marginBottom: '5px', // 5px margin from the avatar
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
            {showWinAnimation && (
              <div 
                className="absolute left-1/2 transform -translate-x-1/2 -translate-y-full mb-2 flex items-center justify-center transition-opacity duration-500"
                style={{ 
                  top: '18px',
                  width: `${55 * scale}px`, 
                  height: `${21 * scale}px`,
                  borderRadius: `${12 * scale}px`,
                  background: '#212027',
                  boxShadow: '0px 0px 4px 2px #EC8800',
                  zIndex: 50,
                  marginBottom: `${8 * scale}px`
                }}
              >
                <span style={{
                  fontWeight: 600,
                  fontStyle: 'normal',
                  fontSize: `${15 * scale}px`,
                  lineHeight: '100%',
                  letterSpacing: '0%',
                  textAlign: 'center',
                  verticalAlign: 'middle',
                  color: '#D2A21B'
                }}>
                  +${Number(winAmount).toFixed(2)}
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
                boxShadow: showWinAnimation 
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
                    ${Number(balance).toFixed(2)}
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
          !hasFolded && ((isWinner && winAmount > 0 && gameStatus === 'finished') ? 
            showCardsPhase : // Для победителей используем только нашу логику
            (showCards || (isCurrentUser && hasLooked))) // Для остальных - обычная логика
        ) && (
          <div className="absolute z-50" style={{ 
            width: `${cardWidth}px`, 
            height: `${cardHeight}px`,
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
              right: `${95 * scale}px`,
              top: '40%',
              transform: 'translateY(-50%)'
            }),
            ...(openCardsPosition === 'right' && {
              left: `${95 * scale}px`,
              top: '40%',
              transform: 'translateY(-50%)'
            })
          }}>
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
        {!hasFolded && (
          <div style={cardDeckStyle} className="flex items-center space-x-2">
            {cardSide === 'left' && TotalBetComponent}
            {!(isCurrentUser && hasLooked) && gameStatus !== 'finished' && CardDeckComponent}
            {cardSide === 'right' && TotalBetComponent}
          </div>
        )}

        {(() => {
          const lastActionAmount = getLastActionAmount();
          const shouldShow = lastActionAmount > 0 && !hasFolded && !isCurrentUser;
          
          return shouldShow ? (
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-white font-semibold text-[10px] leading-none text-center z-40">
              ${Number(lastActionAmount).toFixed(2)}
            </div>
          ) : null;
        })()}
        {score !== undefined && !hasFolded && (showCards || (isCurrentUser && hasLooked)) && (
          <div className="absolute z-50 flex items-center justify-center" style={{ 
            width: `${22 * scale}px`, 
            height: `${22 * scale}px`, 
            backgroundColor: '#FF443A', 
            borderRadius: '50%',
            ...(openCardsPosition === 'bottom' && {
              left: '50%',
              bottom: `${-20 * scale}px`,
              transform: 'translateX(-50%)',
            }),
            ...(openCardsPosition === 'top' && {
              left: `${-45 * scale}px`,
              top: `${40 * scale}px`
            }),
            ...(openCardsPosition === 'left' && {
              right: `${70 * scale}px`,
              top: `${-10 * scale}px`
            }),
            ...(openCardsPosition === 'right' && {
              left: `${70 * scale}px`,
              top: `${-10 * scale}px`
            })
          }}>
            <span style={{ fontWeight: 500, fontStyle: 'normal', fontSize: `${14 * scale}px`, lineHeight: '100%', letterSpacing: '0%', textAlign: 'center', verticalAlign: 'middle', color: '#FFFFFF' }}>
              {score}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
