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
  
  // Состояние для анимаций фишек
  const [chipAnimations, setChipAnimations] = useState<Array<{
    id: string;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    delay: number;
  }>>([]);

  const currentUserId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() || '';

  // Функция для добавления анимации фишки от игрока к столу
  const handlePlayerBet = (playerId: string) => {
    // Находим позицию игрока на экране
    const player = gameState?.players.find(p => p.id === playerId);
    if (!player) return;
    
    // Получаем абсолютную позицию игрока
    const absolutePosition = player.position;
    
    // Преобразуем в относительную позицию для текущего игрока
    const relativePosition = getScreenPosition(absolutePosition);
    
    // Вычисляем координаты аватарки игрока относительно центра стола
    let playerX = 0;
    let playerY = 0;
    
    // Координаты относительно центра стола (315x493 - размер стола)
    const tableWidth = 315 * scale;
    const tableHeight = 493 * scale;
    
    // Вычисляем координаты относительно текущего игрока
    switch (relativePosition) {
      case 1: // верх
        playerX = 0;
        playerY = -tableHeight / 2 - 50;
        break;
      case 2: // верх-право
        playerX = tableWidth / 2 + 50;
        playerY = -tableHeight / 4;
        break;
      case 3: // низ-право
        playerX = tableWidth / 2 + 50;
        playerY = tableHeight / 4;
        break;
      case 4: // низ
        playerX = 0;
        playerY = tableHeight / 2 + 50;
        break;
      case 5: // низ-лево
        playerX = -tableWidth / 2 - 50;
        playerY = tableHeight / 4;
        break;
      case 6: // верх-лево
        playerX = -tableWidth / 2 - 50;
        playerY = -tableHeight / 4;
        break;
    }
    
    const chipId = `chip-${Date.now()}-${Math.random()}`;
    const toX = 0; // центр стола (ChipsStack)
    const toY = 30; // ChipsStack marginTop
    
    console.log('🎯 Player bet animation:', {
      playerId,
      playerUsername: player.username,
      absolutePosition,
      relativePosition,
      fromX: playerX,
      fromY: playerY,
      toX,
      toY
    });
    
    // Проверяем, нет ли уже анимации для этого игрока
    const existingAnimation = chipAnimations.find(chip => chip.id.includes(playerId));
    if (!existingAnimation) {
      setChipAnimations(prev => [...prev, {
        id: chipId,
        fromX: playerX,
        fromY: playerY,
        toX,
        toY,
        delay: 0
      }]);
    } else {
      console.log('⚠️ Skipping duplicate animation for player:', player.username);
    }
  };



  // Функция для анимации фишек к победителю
  const handleChipsToWinner = useCallback((winnerX: number, winnerY: number) => {
    // Подсчитываем количество фишек на столе (как в ChipsStack)
    const chipCount = gameState?.log.filter(action => 
      action.type === 'ante' || 
      action.type === 'blind_bet' || 
      action.type === 'call' || 
      action.type === 'raise'
    ).length || 0;
    
    console.log('🎰 Creating chips animation:', {
      chipCount,
      winnerX,
      winnerY,
      actions: gameState?.log.filter(action => 
        action.type === 'ante' || 
        action.type === 'blind_bet' || 
        action.type === 'call' || 
        action.type === 'raise'
      ).map(a => ({ type: a.type, amount: a.amount }))
    });
    
    // Создаем анимации для каждой фишки
    const chips: Array<{
      id: string;
      fromX: number;
      fromY: number;
      toX: number;
      toY: number;
      delay: number;
    }> = [];
    for (let i = 0; i < chipCount; i++) {
      const chipId = `winner-chip-${Date.now()}-${i}`;
      const fromX = 0; // центр стола (ChipsStack)
      const fromY = 30; // ChipsStack marginTop
      
      chips.push({
        id: chipId,
        fromX,
        fromY,
        toX: winnerX,
        toY: winnerY,
        delay: i * 100 // задержка 100ms между фишками
      });
    }
    
    setChipAnimations(prev => [...prev, ...chips]);
  }, [gameState?.log]);

  // Обработчик завершения анимации фишки
  const handleChipAnimationComplete = (chipId: string) => {
    setChipAnimations(prev => prev.filter(chip => chip.id !== chipId));
  };

  // Отслеживание победы игрока для анимации фишек
  useEffect(() => {
    if (gameState?.status === 'finished' && 
        gameState.winners && 
        gameState.winners.length > 0 && 
        gameState.isAnimating && 
        gameState.animationType === 'win_animation') {
      
      // Лог отладки действий игроков за раунд
      console.log('📊 Round Actions Summary:', {
        roomId: gameState.roomId,
        round: gameState.round,
        pot: gameState.pot,
        winners: gameState.winners.map(w => ({ id: w.id, username: w.username, position: w.position })),
        allActions: gameState.log.map(action => ({
          type: action.type,
          playerId: action.playerId,
          amount: action.amount,
          timestamp: new Date(action.timestamp).toLocaleTimeString()
        })),
        playerActions: gameState.players.map(player => ({
          id: player.id,
          username: player.username,
          position: player.position,
          totalBet: player.totalBet,
          currentBet: player.currentBet,
          hasFolded: player.hasFolded,
          hasLooked: player.hasLooked,
          isActive: player.isActive
        }))
      });
      // Находим позицию победителя для анимации
      const winner = gameState.winners[0]; // берем первого победителя
      
      // Получаем абсолютную позицию победителя
      const absolutePosition = winner.position;
      
      // Преобразуем в относительную позицию для текущего игрока
      const relativePosition = getScreenPosition(absolutePosition);
      
      // Вычисляем координаты аватарки победителя
      let winnerX = 0;
      let winnerY = 0;
      
      const tableWidth = 315 * scale;
      const tableHeight = 493 * scale;
      
      // Вычисляем координаты относительно текущего игрока
      switch (relativePosition) {
        case 1: // верх
          winnerX = 0;
          winnerY = -tableHeight / 2 - 50;
          break;
        case 2: // верх-право
          winnerX = tableWidth / 2 + 50;
          winnerY = -tableHeight / 4;
          break;
        case 3: // низ-право
          winnerX = tableWidth / 2 + 50;
          winnerY = tableHeight / 4;
          break;
        case 4: // низ
          winnerX = 0;
          winnerY = tableHeight / 2 + 50;
          break;
        case 5: // низ-лево
          winnerX = -tableWidth / 2 - 50;
          winnerY = tableHeight / 4;
          break;
        case 6: // верх-лево
          winnerX = -tableWidth / 2 - 50;
          winnerY = -tableHeight / 4;
          break;
      }
      
      // Запускаем анимацию фишек к победителю
      console.log('🎯 Starting chips animation to winner:', {
        winnerId: winner.id,
        winnerUsername: winner.username,
        winnerPosition: winner.position,
        winnerX,
        winnerY,
        chipCount: gameState?.log.filter(action => 
          action.type === 'ante' || 
          action.type === 'blind_bet' || 
          action.type === 'call' || 
          action.type === 'raise'
        ).length || 0
      });
      handleChipsToWinner(winnerX, winnerY);
    }
  }, [gameState?.status, gameState?.winners, gameState?.isAnimating, gameState?.animationType, gameState?.log, gameState?.players, gameState?.pot, gameState?.roomId, gameState?.round, scale, handleChipsToWinner]);

  useEffect(() => {
    if (socket) {
      socket.emit('join_room', { roomId });
    } else {
      console.error('Socket is not initialized in GameRoom');
    }
    return () => {
      if (socket) {
        socket.emit('leave_room', { roomId });
      }
    };
  }, [roomId, socket]);

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
  
  const callAmount = gameState.currentBet - (currentPlayer?.currentBet || 0);
  const minRaiseAmount = gameState.currentBet + gameState.minBet;
  const maxRaise = currentPlayer?.balance || 0;
  const blindBetAmount = gameState.lastBlindBet > 0 ? gameState.lastBlindBet * 2 : gameState.minBet;

  // Проверяем, идет ли анимация
  const isAnimating = gameState.isAnimating || false;
  
  const canPerformBettingActions = isCurrentUserTurn && gameState.status === 'betting' && !isAnimating;
  const canPerformBlindActions = isCurrentUserTurn && gameState.status === 'blind_betting' && !isAnimating;

  const canFold = canPerformBettingActions;
  const canCall = canPerformBettingActions;
  const canRaise = canPerformBettingActions;
  const canLook = canPerformBlindActions;
  const canBlindBet = canPerformBlindActions;

  const isCallDisabled = (currentPlayer?.currentBet ?? 0) >= gameState.currentBet;
  const isRaiseDisabled = (currentPlayer?.balance || 0) < minRaiseAmount;
  const isBlindBetDisabled = (currentPlayer?.balance || 0) < blindBetAmount;
  
  const blindButtonsDisabled = gameState.status !== 'blind_betting';
  
  const showCards = gameState.status === 'showdown' || gameState.status === 'finished' || gameState.showWinnerAnimation || false;
  
  const handleRaiseClick = () => {
    setShowBetSlider(true);
  };

  const handleBlindBetClick = () => {
    actions.blindBet(blindBetAmount);
  };
  
  const handleBetConfirm = (amount: number) => {
    actions.raise(amount);
    setShowBetSlider(false);
  };
  
  const handleSitDown = (position: number) => {
    const hasEnoughBalance = parseFloat(balance) >= gameState.minBet * 10;
    if (!hasEnoughBalance) {
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
                const isActivePhase = gameState.status === 'blind_betting' || gameState.status === 'betting';
                const isTurn = isActivePhase && !!player && gameState.players[gameState.currentPlayerIndex]?.id === player.id && !gameState.isAnimating;

                return (
                  <div key={absolutePosition} style={positionStyle} className={positionClasses}>
                    {player ? (
                      (() => {
                        const isCurrentUser = userData && userData.id && player.id.toString() === userData.id.toString();
                        const isWinner = gameState.winners && gameState.winners.some(winner => winner.id === player.id);
                        const winAmount = isWinner ? gameState.pot / gameState.winners.length : 0;
                        
                        if (isCurrentUser) {
                          const mergedPlayer = { ...player, username: userData.username || userData.first_name || player.username, avatar: userData.photo_url || player.avatar };
                          return <PlayerSpot 
                            player={mergedPlayer} 
                            isCurrentUser={true} 
                            showCards={showCards} 
                            scale={scale} 
                            cardSide={cardSide} 
                            isTurn={isTurn} 
                            onTimeout={actions.fold}
                            isWinner={isWinner}
                            winAmount={winAmount}
                            gameStatus={gameState.status}
                            isAnimating={gameState.isAnimating}
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
                          isTurn={isTurn}
                          isWinner={isWinner}
                          winAmount={winAmount}
                          gameStatus={gameState.status}
                          isAnimating={gameState.isAnimating}
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
                  onFold={actions.fold}
                  onCall={actions.call}
                  onRaise={handleRaiseClick}
                  onLook={actions.lookCards}
                  onBlindBet={handleBlindBetClick}
                  blindButtonsDisabled={blindButtonsDisabled}
                  isCallDisabled={isCallDisabled}
                  isRaiseDisabled={isRaiseDisabled}
                  isBlindBetDisabled={isBlindBetDisabled}
                  minBet={blindBetAmount}
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
      
      {/* Летящие фишки */}
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