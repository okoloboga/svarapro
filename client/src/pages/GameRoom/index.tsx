import { useEffect, useState, useCallback } from 'react';
import { GameRoomProps } from '@/types/game';
import { NotificationType } from '@/types/components';
import { Notification } from '@/components/Notification';
import { useGameState } from '@/hooks/useGameState';
import GameTable from '../../components/GameProcess/GameTable';
import { ActionButtons } from '../../components/GameProcess/ActionButton';
import { BetSlider } from '../../components/GameProcess/BetSlider';
import { Socket } from 'socket.io-client';
import { LoadingPage } from '../../components/LoadingPage';
import { PlayerSpot } from '../../components/GameProcess/PlayerSpot';
import { SeatButton } from '../../components/GameProcess/SeatButton';
import { UserData, PageData } from '@/types/entities';
import FlyingChip from '../../components/GameProcess/FlyingChip';
import { Page } from '@/types/page';
import backgroundImage from '../../assets/game/background.jpg';
import menuIcon from '../../assets/game/menu.svg';
import { GameMenu } from '../../components/GameProcess/GameMenu';
import { SvaraJoinPopup } from '../../components/SvaraJoinPopup';
import { TURN_DURATION_SECONDS } from '@/constants';

interface GameRoomPropsExtended extends GameRoomProps {
  socket: Socket | null;
  setCurrentPage: (page: Page, data?: Record<string, unknown>) => void;
  userData: UserData;
  pageData: PageData | null;
}

const useWindowSize = () => {
  const [size, setSize] = useState([typeof window !== 'undefined' ? window.innerWidth : 0, typeof window !== 'undefined' ? window.innerHeight : 0]);
  useEffect(() => {
    function updateSize() {
      setSize([window.innerWidth, window.innerHeight]);
    }
    window.addEventListener('resize', updateSize);
    updateSize();
    return () => window.removeEventListener('resize', updateSize);
  }, []);
  return size;
};

const useTablePositioning = () => {
  const [windowWidth] = useWindowSize();
  const [tableSize] = useState({ width: 315, height: 493 });

  const scale = windowWidth > 0 ? (windowWidth * 0.85) / tableSize.width : 0;

  const getPositionClasses = (position: number): string => {
    const baseClasses = "absolute z-20 transition-all duration-300 ease-in-out hover:scale-105 hover:z-30 w-20 h-24 flex items-center justify-center";
    const positionClasses = {
      1: "-top-10 left-1/2",
      2: "top-1/4 -right-5",
      3: "bottom-1/4 -right-5",
      4: "-bottom-10 left-1/2",
      5: "bottom-1/4 -left-5",
      6: "top-1/4 -left-5",
    };
    return `${baseClasses} ${positionClasses[position as keyof typeof positionClasses] || ''}`;
  };

  const getPositionStyle = (position: number): React.CSSProperties => {
    let transform = `scale(${scale})`;
    if (position === 1 || position === 4) {
      transform += ' translateX(-50%)';
    }
    return { transform };
  };

  return { getPositionStyle, getPositionClasses, scale };
};

export function GameRoom({ roomId, balance, socket, setCurrentPage, userData, pageData }: GameRoomPropsExtended) {
  const { gameState, loading, error, isSeated, actions } = useGameState(roomId, socket);
  const [showBetSlider, setShowBetSlider] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [notification, setNotification] = useState<NotificationType | null>(null);
  const { getPositionStyle, getPositionClasses, scale } = useTablePositioning();
  const [turnTimer, setTurnTimer] = useState(TURN_DURATION_SECONDS);
  
  const [chipAnimations, setChipAnimations] = useState<Array<{
    id: string;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    delay: number;
  }>>([]);

  const currentUserId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() || '';

  if (loading) return <LoadingPage isLoading={loading} />;

  if (error) {
    return (
      <div className="bg-primary min-h-screen flex flex-col items-center justify-center">
        <div className="text-red-500 text-xl">Ошибка: {error}</div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="bg-primary min-h-screen flex flex-col items-center justify-center">
        <div className="text-red-500 text-xl">Ошибка: Не удалось загрузить состояние игры</div>
      </div>
    );
  }

  const currentPlayer = gameState.players.find(p => p.id === currentUserId);
  const currentUserPosition = currentPlayer?.position;

  const getScreenPosition = (absolutePosition: number) => {
    if (!currentUserPosition || !isSeated) {
      return absolutePosition;
    }
    const offset = 4 - currentUserPosition;
    return ((absolutePosition + offset - 1 + 6) % 6) + 1;
  };
  
  const isCurrentUserTurn = isSeated && gameState.players[gameState.currentPlayerIndex]?.id === currentUserId && !gameState.isAnimating;
  
  const callAmount = gameState.status === 'betting' 
    ? (gameState.lastActionAmount > 0 ? gameState.lastActionAmount : gameState.currentBet - (currentPlayer?.currentBet || 0))
    : gameState.currentBet - (currentPlayer?.currentBet || 0);
    
  const minRaiseAmount = gameState.currentBet * 2;
  const maxRaise = currentPlayer?.balance || 0;
  const blindBetAmount = gameState.lastBlindBet > 0 ? gameState.lastBlindBet * 2 : gameState.minBet;

  const isAnimating = gameState.isAnimating || false;
  
  const canPerformBettingActions = isCurrentUserTurn && gameState.status === 'betting' && !isAnimating;
  const canPerformBlindActions = isCurrentUserTurn && gameState.status === 'blind_betting' && !isAnimating;

  const canFold = canPerformBettingActions;
  const canCall = canPerformBettingActions;
  const canRaise = canPerformBettingActions;
  const canLook = canPerformBlindActions;
  const canBlindBet = canPerformBlindActions;

  const isCallDisabled = gameState.status === 'betting' 
    ? false
    : (currentPlayer?.currentBet ?? 0) >= gameState.currentBet;
  const isRaiseDisabled = (currentPlayer?.balance || 0) < minRaiseAmount;
  const isBlindBetDisabled = (currentPlayer?.balance || 0) < blindBetAmount;
  
  const blindButtonsDisabled = gameState.status !== 'blind_betting';
  
  const showCards = gameState.status === 'showdown' || gameState.status === 'finished' || gameState.showWinnerAnimation || false;

  useEffect(() => {
    if (isCurrentUserTurn) {
      setTurnTimer(TURN_DURATION_SECONDS);
      const interval = setInterval(() => {
        setTurnTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            actions.fold();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setTurnTimer(TURN_DURATION_SECONDS);
    }
  }, [isCurrentUserTurn, actions]);

  const handlePlayerBet = (playerId: string) => {
    const player = gameState?.players.find(p => p.id === playerId);
    if (!player) return;
    
    const absolutePosition = player.position;
    const isCurrentPlayer = player.id === currentUserId;
    const relativePosition = isCurrentPlayer ? absolutePosition : getScreenPosition(absolutePosition);
    
    let playerX = 0;
    let playerY = 0;
    
    const tableWidth = 315 * scale;
    const tableHeight = 493 * scale;
    
    switch (relativePosition) {
      case 1: playerX = tableWidth / 2; playerY = -50; break;
      case 2: playerX = tableWidth + 50; playerY = tableHeight / 4; break;
      case 3: playerX = tableWidth + 50; playerY = tableHeight * 3 / 4; break;
      case 4: playerX = tableWidth / 2; playerY = tableHeight + 50; break;
      case 5: playerX = -50; playerY = tableHeight * 3 / 4; break;
      case 6: playerX = -50; playerY = tableHeight / 4; break;
    }
    
    const chipId = `chip-${Date.now()}-${Math.random()}`;
    const toX = (315 * scale) / 2;
    const toY = (493 * scale) / 2 + 30;
    
    const existingAnimation = chipAnimations.find(chip => chip.id.includes(playerId));
    if (!existingAnimation) {
      setChipAnimations(prev => [...prev, { id: chipId, fromX: playerX, fromY: playerY, toX, toY, delay: 0 }]);
    }
  };

  const handleChipsToWinner = useCallback((winnerX: number, winnerY: number) => {
    const chipCount = gameState?.log.filter(action => 
      action.type === 'ante' || 
      action.type === 'blind_bet' || 
      action.type === 'call' || 
      action.type === 'raise'
    ).length || 0;
    
    const chips: Array<any> = [];
    for (let i = 0; i < chipCount; i++) {
      const chipId = `winner-chip-${Date.now()}-${i}`;
      chips.push({ id: chipId, fromX: 0, fromY: 30, toX: winnerX, toY: winnerY, delay: i * 100 });
    }
    
    setChipAnimations(prev => [...prev, ...chips]);
  }, [gameState?.log]);

  const handleChipAnimationComplete = (chipId: string) => {
    setChipAnimations(prev => prev.filter(chip => chip.id !== chipId));
  };

  useEffect(() => {
    if (gameState?.status === 'finished') {
      console.log('🏆 GameState Debug (finished):', { ...gameState });
    }
    if (gameState?.status === 'finished' && gameState.winners && gameState.winners.length > 0 && isAnimating && gameState.animationType === 'win_animation') {
      console.log('📊 Round Actions Summary:', { ...gameState });
    }
  }, [gameState, isAnimating, scale, handleChipsToWinner]);

  // Дополнительная логика для очистки фишек после завершения раунда
  useEffect(() => {
    if (gameState?.status === 'finished' && gameState?.pot === 0) {
      // Очищаем все анимации фишек
      setChipAnimations([]);
    }
  }, [gameState?.status, gameState?.pot]);

  useEffect(() => {
    if (pageData?.autoSit && !isSeated && gameState) {
      const seatedPositions = gameState.players.map(p => p.position);
      let positionToSit = 1;
      while(seatedPositions.includes(positionToSit)) {
        positionToSit++;
      }
      if (positionToSit <= 6) {
        actions.sitDown(positionToSit, userData);
      }
    }
  }, [pageData, isSeated, gameState, actions, userData]);

  const handleRaiseClick = () => setShowBetSlider(true);
  const handleBlindBetClick = () => actions.blindBet(blindBetAmount);
  const handleBetConfirm = (amount: number) => {
    actions.raise(amount);
    setShowBetSlider(false);
  };
  const handleSitDown = (position: number) => {
    if (parseFloat(balance) < gameState.minBet * 10) {
      setNotification('insufficientBalance');
      return;
    }
    actions.sitDown(position, userData);
  };
  const handleLeaveRoom = () => {
    setShowMenuModal(false);
    setShowBetSlider(false);
    actions.leaveRoom();
    setCurrentPage('dashboard');
  };

  return (
    <div style={{ backgroundImage: `url(${backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center', minHeight: '100vh' }} className="flex flex-col relative">
      {gameState.status === 'svara_pending' && (
        <SvaraJoinPopup 
          gameState={gameState}
          userData={userData}
          actions={actions}
        />
      )}

      <div className="text-white p-4 flex justify-between items-center">
        <h2 className="text-xs font-semibold">Комната №{roomId.slice(0, 8)}</h2>
        <div className="flex items-center space-x-3">
          <button onClick={() => setShowMenuModal(true)} className="transition-all duration-200 ease-in-out hover:opacity-75">
            <img src={menuIcon} alt="Меню" className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      <div className="flex-grow relative p-4 z-10">
        <div className="relative flex justify-center items-center min-h-[70vh] w-full p-4 sm:p-5 lg:p-6 game-table-container -mt-8">
          <div className="relative flex justify-center items-center w-full h-full">
            <div className="flex-shrink-0 relative z-10">
              <GameTable 
                gameState={gameState} 
                currentUserId={currentUserId} 
                showCards={showCards} 
                onSitDown={handleSitDown} 
                onInvite={actions.invitePlayer} 
                maxPlayers={6} 
                scale={scale}
                onChipsToWinner={handleChipsToWinner}
                chipAnimations={chipAnimations}
                onChipAnimationComplete={handleChipAnimationComplete}
              />
            </div>
            
            {
              Array.from({ length: 6 }).map((_, index) => {
                const absolutePosition = index + 1;
                const screenPosition = getScreenPosition(absolutePosition);
                const player = gameState.players.find(p => p.position === absolutePosition);
                const positionStyle = getPositionStyle(screenPosition);
                const positionClasses = getPositionClasses(screenPosition);

                const cardSide = (screenPosition === 2 || screenPosition === 3) ? 'left' : 'right';
                
                const getOpenCardsPosition = (position: number) => {
                  switch (position) {
                    case 1: return 'bottom';
                    case 2: return 'left';
                    case 3: return 'left';
                    case 4: return 'top';
                    case 5: return 'right';
                    case 6: return 'right';
                    default: return 'top';
                  }
                };
                
                const openCardsPosition = getOpenCardsPosition(screenPosition);
                const isTurn = isCurrentUserTurn && !!player && gameState.players[gameState.currentPlayerIndex]?.id === player.id;

                return (
                  <div key={absolutePosition} style={positionStyle} className={positionClasses}>
                    {player ? (
                      (() => {
                        const isCurrentUser = userData && userData.id && player.id.toString() === userData.id.toString();
                        const isWinner = gameState.winners && gameState.winners.some(winner => winner.id === player.id);
                        const winAction = gameState.log.find(action => action.type === 'win' && action.telegramId === player.id);
                        const winAmount = winAction ? winAction.amount : 0;
                        
                        if (isCurrentUser) {
                          const mergedPlayer = { ...player, username: userData.username || userData.first_name || player.username, avatar: userData.photo_url || player.avatar };
                          return <PlayerSpot 
                            player={mergedPlayer} 
                            isCurrentUser={true} 
                            showCards={showCards} 
                            scale={scale} 
                            cardSide={cardSide} 
                            openCardsPosition={openCardsPosition}
                            isTurn={isTurn} 
                            turnTimer={turnTimer}
                            isWinner={isWinner}
                            winAmount={winAmount}
                            gameStatus={gameState.status}
                            onPlayerBet={handlePlayerBet}
                            gameState={gameState}
                          />;
                        }
                        return <PlayerSpot 
                          player={player} 
                          isCurrentUser={false} 
                          showCards={showCards} 
                          scale={scale} 
                          cardSide={cardSide} 
                          openCardsPosition={openCardsPosition}
                          isTurn={isTurn}
                          turnTimer={turnTimer}
                          isWinner={isWinner}
                          winAmount={winAmount}
                          gameStatus={gameState.status}
                          onPlayerBet={handlePlayerBet}
                          gameState={gameState}
                        />;
                      })()
                    ) : (
                      <SeatButton type={isSeated ? 'invite' : 'sitdown'} position={absolutePosition} onSitDown={handleSitDown} onInvite={() => {}} scale={scale} />
                    )}
                  </div>
                )
              })
            }
          </div>
        </div>
      </div>
      
      {isSeated && (
        <div className="p-4">
          <div className="flex flex-col items-center space-y-4">
            <div>
              {gameState.status === 'waiting' ? (
                <div className="p-4 flex items-center justify-center h-full">
                  <p className="text-white font-bold text-[10px] leading-[150%] tracking-[-0.011em] text-center">Ждем игроков</p>
                </div>
              ) : gameState.status === 'ante' ? (
                <div className="bg-gray-800 text-white p-4 rounded-lg flex items-center justify-center h-full">
                  <p className="text-xl">Внесение начальных ставок...</p>
                </div>
              ) : isCurrentUserTurn ? (
                <ActionButtons 
                  canFold={canFold}
                  canCall={canCall}
                  canRaise={canRaise}
                  canLook={canLook}
                  canBlindBet={canBlindBet}
                  callAmount={callAmount}
                  turnTimer={turnTimer}
                  onFold={actions.fold}
                  onCall={actions.call}
                  onRaise={handleRaiseClick}
                  onLook={actions.lookCards}
                  onBlindBet={handleBlindBetClick}
                  blindButtonsDisabled={blindButtonsDisabled}
                  isCallDisabled={isCallDisabled}
                  isRaiseDisabled={isRaiseDisabled}
                  isBlindBetDisabled={isBlindBetDisabled}
                  minBet={gameState.status === 'blind_betting' ? blindBetAmount : minRaiseAmount}
                />
              ) : (
                <div className="p-4 flex items-center justify-center h-full">
                  <p className="text-white font-bold text-[10px] leading-[150%] tracking-[-0.011em] text-center">В ожидании следующего раунда</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      <BetSlider isOpen={showBetSlider} onClose={() => setShowBetSlider(false)} minBet={minRaiseAmount} maxBet={maxRaise} initialBet={minRaiseAmount} onConfirm={handleBetConfirm} />
      
      <GameMenu isOpen={showMenuModal} onClose={() => setShowMenuModal(false)} onExit={handleLeaveRoom} />

      {notification && <Notification type={notification} onClose={() => setNotification(null)} />}
      
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ zIndex: 1000 }}>
        {chipAnimations.map(chip => (
          <FlyingChip
            key={chip.id}
            fromX={chip.fromX}
            fromY={chip.fromY}
            toX={chip.toX}
            toY={chip.toY}
            delay={chip.delay}
            onComplete={() => handleChipAnimationComplete(chip.id)}
          />
        ))}
      </div>
    </div>
  );
}