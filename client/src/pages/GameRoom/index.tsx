import { useEffect, useState, useCallback, useRef } from 'react';
import { GameRoomProps, GameState } from '@/types/game';
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
import chatButton from '../../assets/game/chatButton.png';
import { GameMenu } from '../../components/GameProcess/GameMenu';
import { ChatMenu } from '../../components/GameProcess/ChatMenu';
import { SvaraAnimation } from '../../components/GameProcess/SvaraAnimation';
import { SvaraJoinPopup } from '../../components/GameProcess/SvaraJoinPopup';
import { TURN_DURATION_SECONDS } from '@/constants';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useAppBackButton } from '@/hooks/useAppBackButton';

interface ChipAnimation {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  delay: number;
}

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
    updateSize(); // Initial size

    // Force a second update after a short delay to handle viewport transitions
    const timer = setTimeout(() => updateSize(), 100);

    return () => {
      window.removeEventListener('resize', updateSize);
      clearTimeout(timer);
    };
  }, []);
  return size;
};

const useTablePositioning = () => {
  const [windowWidth] = useWindowSize();
  const [tableSize] = useState({ width: 315, height: 493 });

  const scale = windowWidth > 0 ? (windowWidth * 0.85) / tableSize.width : 0;

  const getPositionClasses = (position: number, isShowdown: boolean): string => {
    const zIndex = isShowdown ? 'z-40' : 'z-30';
    const baseClasses = `absolute ${zIndex} transition-all duration-300 ease-in-out hover:scale-105 hover:z-40 w-20 h-24 flex items-center justify-center`;
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
  const { gameState, loading, error, isSeated, isProcessing, actions } = useGameState(roomId, socket);
  const [showBetSlider, setShowBetSlider] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [activeChats, setActiveChats] = useState<Record<string, { phrase: string; timerId: NodeJS.Timeout }>>({});
  const [notification, setNotification] = useState<NotificationType | null>(null);
  const { getPositionStyle, getPositionClasses, scale } = useTablePositioning();
  const [turnTimer, setTurnTimer] = useState(TURN_DURATION_SECONDS);
  const [svaraStep, setSvaraStep] = useState<'none' | 'animating' | 'joining'>('none');
  const { triggerImpact } = useHapticFeedback();
  const currentUserId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() || '';
  const currentTurnRef = useRef<string>(''); // Отслеживаем текущий ход

  useEffect(() => {
    if (gameState?.status === 'svara_pending' && svaraStep === 'none') {
      setSvaraStep('animating');
    } else if (gameState?.status !== 'svara_pending') {
      setSvaraStep('none');
    }
  }, [gameState?.status, svaraStep]);

  const handleLeaveRoom = useCallback(() => {
    setShowMenuModal(false);
    setShowBetSlider(false);
    if (actions) {
      actions.leaveRoom();
    }
    setCurrentPage('dashboard');
  }, [actions, setCurrentPage]);

  useAppBackButton(true, handleLeaveRoom);

  useEffect(() => {
    if (gameState && gameState.status === 'svara_pending' && (gameState.svaraParticipants?.includes(currentUserId) ?? false)) {
      // Если я победитель - я не могу отказаться от свары, участвую автоматически
      actions.joinSvara();
    }
  }, [gameState, currentUserId, actions]);

  const [chipAnimations, setChipAnimations] = useState<Array<ChipAnimation>>([]);
  const [winSoundPlayed, setWinSoundPlayed] = useState(false);

  // Chat message handling
  useEffect(() => {
    if (!socket) return;

    const handleNewChatMessage = ({ playerId, phrase }: { playerId: string; phrase: string }) => {
      console.log('🗨️ Received new_chat_message:', { playerId, phrase, currentUserId });
      setActiveChats(prev => {
        // Clear previous timer for this player if it exists
        if (prev[playerId]) {
          clearTimeout(prev[playerId].timerId);
        }
        // Set new message and timer
        const timerId = setTimeout(() => {
          setActiveChats(currentChats => {
            const newChats = { ...currentChats };
            delete newChats[playerId];
            return newChats;
          });
        }, 2000);

        const newState = {
          ...prev,
          [playerId]: { phrase, timerId },
        };
        console.log('🗨️ Updated activeChats:', newState);
        return newState;
      });
    };

    socket.on('new_chat_message', handleNewChatMessage);

    return () => {
      socket.off('new_chat_message', handleNewChatMessage);
      // Clear all timers on cleanup
      setActiveChats(prev => {
        Object.values(prev).forEach(chat => clearTimeout(chat.timerId));
        return {};
      });
    };
  }, [socket]);

  const handleSelectPhrase = (phrase: string) => {
    if (socket) {
      console.log('🗨️ Sending chat_message:', { roomId, phrase, currentUserId });
      socket.emit('chat_message', { roomId, phrase });
      setShowChatMenu(false); // Close chat menu after sending
    }
  };

  const activeGamePhases: GameState['status'][] = ['blind_betting', 'betting'];
  const isCurrentUserTurn = !!(isSeated && gameState && activeGamePhases.includes(gameState.status) && gameState.players[gameState.currentPlayerIndex]?.id === currentUserId && !gameState.isAnimating && !isProcessing);

  useEffect(() => {
    const activeTurn = gameState && activeGamePhases.includes(gameState.status) && !gameState.isAnimating;
    const currentPlayerId = gameState?.players[gameState?.currentPlayerIndex]?.id;
    const turnKey = `${gameState?.status}-${currentPlayerId}-${gameState?.currentPlayerIndex}`;

    console.log('⏰ Timer effect triggered:', {
      activeTurn,
      currentPlayerId,
      currentUserId,
      isCurrentUserTurn,
      gameStateStatus: gameState?.status,
      currentPlayerIndex: gameState?.currentPlayerIndex,
      isAnimating: gameState?.isAnimating,
      turnKey,
      currentTurnRef: currentTurnRef.current
    });

    if (activeTurn) {
      // Сбрасываем таймер только если это новый ход
      if (turnKey !== currentTurnRef.current) {
        console.log('⏰ New turn detected, resetting timer to:', TURN_DURATION_SECONDS, 'seconds');
        currentTurnRef.current = turnKey;
        setTurnTimer(TURN_DURATION_SECONDS);
      } else {
        console.log('⏰ Same turn, keeping timer at:', turnTimer, 'seconds');
      }
      
      const interval = setInterval(() => {
        setTurnTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setTurnTimer(TURN_DURATION_SECONDS);
    }
  }, [gameState?.status, gameState?.currentPlayerIndex, gameState?.isAnimating, isCurrentUserTurn, currentUserId]);

  // Separate effect for auto-fold when timer reaches 0
  useEffect(() => {
    if (turnTimer === 0 && isCurrentUserTurn) {
      actions.fold();
    }
  }, [turnTimer, isCurrentUserTurn, actions]);

  useEffect(() => {
    if (isCurrentUserTurn) {
      triggerImpact('medium');
      actions.playSound('turn');
    }
  }, [isCurrentUserTurn, triggerImpact, actions]);

  // Track fold actions for all players and play fold sound
  useEffect(() => {
    if (!gameState?.log) return;
    
    // Простая проверка: смотрим на последнее действие
    const lastAction = gameState.log[gameState.log.length - 1];
    console.log('🔍 Last action in log:', lastAction);
    
    if (lastAction && lastAction.type === 'fold') {
      console.log('🎵 Fold action detected, playing sound:', lastAction);
      actions.playSound('fold');
    }
  }, [gameState?.log, actions]);

  // Track other player actions for animations (only when log length changes)
  const prevLogLengthRef = useRef(0);
  const lastProcessedActionRef = useRef<string>('');
  
  useEffect(() => {
    if (!gameState?.log) return;
    
    const currentLogLength = gameState.log.length;
    if (currentLogLength > prevLogLengthRef.current) {
      // Новое действие добавлено в лог
      const lastAction = gameState.log[currentLogLength - 1];
      console.log('🎯 New action detected in log:', lastAction);
      
      // Создаем уникальный ключ для действия
      const actionKey = `${lastAction.telegramId}-${lastAction.type}-${Date.now()}`;
      
      if (lastAction && 
          lastAction.telegramId !== currentUserId && 
          ['blind_bet', 'call', 'raise'].includes(lastAction.type) &&
          actionKey !== lastProcessedActionRef.current) {
        console.log('🎯 Creating animation for other player action:', lastAction);
        lastProcessedActionRef.current = actionKey;
        handleOtherPlayerAction(lastAction.telegramId);
      }
    }
    
    prevLogLengthRef.current = currentLogLength;
  }, [gameState?.log?.length, currentUserId]); // Зависимость только от длины лога

  // Play win sound for current user if they won (after 3 seconds delay)
  useEffect(() => {
    if (!gameState?.winners || gameState.status !== 'finished') {
      // Reset flags when game is not finished
      if (gameState?.status !== 'finished') {
        setWinSoundPlayed(false);
      }

      return;
    }
    
    const currentUserWon = gameState.winners.some(winner => winner.id === currentUserId);
    if (currentUserWon && !winSoundPlayed) {
      // Wait 3 seconds (cards phase) then play win sound during animation phase
      const winSoundTimer = setTimeout(() => {
        actions.playSound('win');
        setWinSoundPlayed(true);
      }, 3000);
      
      return () => clearTimeout(winSoundTimer);
    }
  }, [gameState?.winners, gameState?.status, currentUserId, actions, winSoundPlayed]);


  const handleChipsToWinner = useCallback((winnerX: number, winnerY: number) => {
    const chipCount = gameState?.log.filter(action => 
      action.type === 'ante' || 
      action.type === 'blind_bet' || 
      action.type === 'call' || 
      action.type === 'raise'
    ).length || 0;
    
    const chips: Array<ChipAnimation> = [];
    for (let i = 0; i < chipCount; i++) {
      const chipId = `winner-chip-${Date.now()}-${i}`;
      chips.push({ id: chipId, fromX: 0, fromY: 30, toX: winnerX, toY: winnerY, delay: i * 100 });
    }
    
    setChipAnimations(prev => [...prev, ...chips]);
  }, [gameState?.log]);

  const handleChipAnimationComplete = useCallback((chipId: string) => {
    console.log('🎯 Chip animation completed:', chipId);
    setChipAnimations(prev => {
      const newAnimations = prev.filter(chip => chip.id !== chipId);
      console.log('🎯 Remaining animations:', newAnimations.length);
      return newAnimations;
    });
  }, []);

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
  
  const callAmount = gameState.lastActionAmount;
  const isAnimating = !!(gameState.isAnimating);
  const postLookActions = isCurrentUserTurn && !!currentPlayer?.hasLookedAndMustAct;
  const postLookCallAmount = gameState.lastBlindBet > 0 ? gameState.lastBlindBet * 2 : gameState.minBet;
    
  const minRaiseAmount = (() => {
    if (postLookActions) {
      return gameState.lastBlindBet > 0
        ? gameState.lastBlindBet * 2
        : gameState.minBet;
    }
    return gameState.lastActionAmount * 2;
  })();

  const maxRaise = currentPlayer?.balance || 0;
  const blindBetAmount = gameState.lastBlindBet > 0 ? gameState.lastBlindBet * 2 : gameState.minBet;
  
  const canPerformBettingActions = !!(isCurrentUserTurn && gameState.status === 'betting' && !isAnimating && !postLookActions);
  const canPerformBlindActions = !!(isCurrentUserTurn && gameState.status === 'blind_betting' && !isAnimating && !postLookActions);

  const canFold = canPerformBettingActions || postLookActions;
  const canCall = canPerformBettingActions || postLookActions;
  const canRaise = canPerformBettingActions || postLookActions;
  const canLook = canPerformBlindActions;
  const canBlindBet = canPerformBlindActions;

  const isCallDisabled = !!(gameState.status === 'betting' || gameState.status === 'blind_betting'
    ? false
    : (currentPlayer?.currentBet ?? 0) >= gameState.currentBet);
  const isRaiseDisabled = !!((currentPlayer?.balance || 0) < minRaiseAmount);
  const isBlindBetDisabled = !!((currentPlayer?.balance || 0) < blindBetAmount);
  
  const blindButtonsDisabled = !!(gameState.status !== 'blind_betting');
  
  const showCards = !!(gameState.status === 'showdown' || gameState.status === 'finished' || gameState.showWinnerAnimation);

  // Обработчик для анимации действий других игроков
  const handleOtherPlayerAction = (playerId: string) => {
    console.log('🎯 Other player action detected for:', playerId);
    handlePlayerBet(playerId);
  };

  const handlePlayerBet = (playerId: string) => {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player || !player.isActive) {
      console.log('❌ Cannot create chip animation: player not found or not active:', playerId);
      return;
    }
    
    // Проверяем, не создается ли уже анимация для этого игрока
    const existingAnimation = chipAnimations.find(chip => chip.id.includes(playerId));
    if (existingAnimation) {
      console.log('🎯 Skipping chip animation - already exists for player:', playerId);
      return;
    }
    
    const absolutePosition = player.position;
    const isCurrentPlayer = player.id === currentUserId;
    // Текущий игрок ВСЕГДА в позиции 4 (снизу по центру), другие игроки преобразуются через getScreenPosition
    const relativePosition = isCurrentPlayer ? 4 : getScreenPosition(absolutePosition);
    
    // Получаем координаты на основе CSS классов позиций PlayerSpot
    let playerX = 0;
    let playerY = 0;
    
    // Центр экрана (где находится банк)
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    
    // Вычисляем позицию игрока на основе CSS классов из getPositionClasses
    // Используем точные координаты, соответствующие реальным позициям PlayerSpot
    const tableWidth = 315 * scale; // Ширина стола
    const tableHeight = 493 * scale; // Высота стола
    const verticalOffset = 100; // Смещение вверх для всех позиций
    
    switch (relativePosition) {
      case 1: // -top-10 left-1/2 (верхний центр)
        playerX = centerX;
        playerY = centerY - tableHeight * 0.4 - verticalOffset; // Поднимаем выше
        break;
      case 2: // top-1/4 -right-5 (правый верхний)
        playerX = centerX + tableWidth * 0.4;
        playerY = centerY - tableHeight * 0.25 - verticalOffset; // Поднимаем выше
        break;
      case 3: // bottom-1/4 -right-5 (правый нижний)
        playerX = centerX + tableWidth * 0.4;
        playerY = centerY + tableHeight * 0.25 - verticalOffset; // Поднимаем выше
        break;
      case 4: // -bottom-10 left-1/2 (нижний центр) - текущий пользователь
        playerX = centerX;
        playerY = centerY + tableHeight * 0.4 - verticalOffset; // Поднимаем выше
        break;
      case 5: // bottom-1/4 -left-5 (левый нижний)
        playerX = centerX - tableWidth * 0.4;
        playerY = centerY + tableHeight * 0.25 - verticalOffset; // Поднимаем выше
        break;
      case 6: // top-1/4 -left-5 (левый верхний)
        playerX = centerX - tableWidth * 0.4;
        playerY = centerY - tableHeight * 0.25 - verticalOffset; // Поднимаем выше
        break;
    }
    
    const chipId = `chip-${Date.now()}-${Math.random()}`;
    
    console.log('🎯 Chip animation coordinates:', {
      playerId,
      relativePosition,
      isCurrentPlayer,
      absolutePosition,
      playerX,
      playerY,
      centerX,
      centerY
    });
    
    console.log('🎯 Creating chip animation for player:', playerId, 'at position:', relativePosition);
    setChipAnimations(prev => [...prev, { 
      id: chipId, 
      fromX: playerX, 
      fromY: playerY, 
      toX: centerX, 
      toY: centerY, 
      delay: 0 
    }]);
  };

  const handleRaiseClick = () => setShowBetSlider(true);
  const handleBlindBetClick = () => {
    // Проверяем, что игрок активен и это его ход
    if (!currentPlayer || !currentPlayer.isActive || !isCurrentUserTurn) {
      console.log('❌ Cannot perform blind bet: player not active or not turn');
      return;
    }
    
    // Запускаем анимацию фишки для текущего игрока
    handlePlayerBet(currentPlayer.id);
    actions.blindBet(blindBetAmount);
  };
  const handleBetConfirm = (amount: number) => {
    // Проверяем, что игрок активен и это его ход
    if (!currentPlayer || !currentPlayer.isActive || !isCurrentUserTurn) {
      console.log('❌ Cannot perform raise: player not active or not turn');
      return;
    }
    
    // Запускаем анимацию фишки для текущего игрока
    handlePlayerBet(currentPlayer.id);
    actions.raise(amount);
    setShowBetSlider(false);
  };

  const handleCallClick = () => {
    // Проверяем, что игрок активен и это его ход
    if (!currentPlayer || !currentPlayer.isActive || !isCurrentUserTurn) {
      console.log('❌ Cannot perform call: player not active or not turn');
      return;
    }
    
    // Запускаем анимацию фишки для текущего игрока
    handlePlayerBet(currentPlayer.id);
    actions.call();
  };
  const handleSitDown = (position: number) => {
    if (parseFloat(balance) < gameState.minBet * 10) {
      setNotification('insufficientBalance');
      return;
    }
    actions.sitDown(position, userData);
  };

  return (
    <div style={{ backgroundImage: `url(${backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center', minHeight: '100vh' }} className="flex flex-col relative">
      {/* Затемняющий оверлей для фазы вскрытия карт */}
      {showCards && <div className="fixed inset-0 bg-black bg-opacity-60 z-20 transition-opacity duration-500" />}

      {svaraStep === 'animating' && <SvaraAnimation onAnimationComplete={() => setSvaraStep('joining')} />}
      
      {svaraStep === 'joining' && !(gameState.svaraParticipants?.includes(currentUserId) ?? false) && (
        <SvaraJoinPopup 
          gameState={gameState}
          userData={userData}
          actions={actions}
        />
      )}

      <div className="relative z-30 text-white p-4 flex justify-between items-center">
        <h2 className="text-xs font-semibold">Комната №{roomId.slice(0, 8)}</h2>
        <div className="flex items-center space-x-3">
          <button onClick={() => setShowMenuModal(true)} className="transition-all duration-200 ease-in-out hover:opacity-75">
            <img src={menuIcon} alt="Меню" className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      <div className="flex-grow relative p-4">
        <div className="relative flex justify-center items-center min-h-[70vh] w-full p-4 sm:p-5 lg:p-6 game-table-container -mt-8">
          <div className="relative flex justify-center items-center w-full h-full">
            <div className="flex-shrink-0 relative z-10">
              <GameTable 
                gameState={gameState} 
                currentUserId={currentUserId} 
                showCards={showCards} 
                onSitDown={handleSitDown} 
                onInvite={actions.invitePlayer} 
                onChatOpen={() => setShowChatMenu(true)}
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
                const positionClasses = getPositionClasses(screenPosition, showCards);

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
                const isTurn = !!(gameState && player && gameState.players[gameState.currentPlayerIndex]?.id === player.id);
                const chatPhrase = player ? activeChats[player.id]?.phrase : undefined;

                return (
                  <div key={absolutePosition} style={positionStyle} className={positionClasses}>
                    {player ? (
                      (() => {
                        const isCurrentUser = userData && userData.id && player.id.toString() === userData.id.toString();
                        const isWinner = gameState.winners && gameState.winners.some(winner => winner.id === player.id);
                        // const winAction = gameState.log.find(action => action.type === 'win' && action.telegramId === player.id);
                        // Для отображения используем банк минус 5% налог
                        const winAmount = isWinner && gameState.pot > 0 ? Number((gameState.pot * 0.95).toFixed(2)) : 0;
                        
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
                            chatPhrase={chatPhrase}
                            onPlayerBet={undefined}
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
                          chatPhrase={chatPhrase}
                          onPlayerBet={undefined}
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
                  postLookActions={postLookActions}
                  canFold={canFold}
                  canCall={canCall}
                  canRaise={canRaise}
                  canLook={canLook}
                  canBlindBet={canBlindBet}
                  callAmount={postLookActions ? postLookCallAmount : callAmount}
                  turnTimer={turnTimer}
                  onFold={actions.fold}
                  onCall={handleCallClick}
                  onRaise={handleRaiseClick}
                  onLook={actions.lookCards}
                  onBlindBet={handleBlindBetClick}
                  blindButtonsDisabled={blindButtonsDisabled || isProcessing}
                  isCallDisabled={isCallDisabled || isProcessing}
                  isRaiseDisabled={isRaiseDisabled || isProcessing}
                  isBlindBetDisabled={isBlindBetDisabled || isProcessing}
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
      
      <BetSlider isOpen={showBetSlider} onClose={() => setShowBetSlider(false)} minBet={minRaiseAmount} maxBet={maxRaise} initialBet={minRaiseAmount} onConfirm={handleBetConfirm} isTurn={isCurrentUserTurn} turnTimer={turnTimer} isProcessing={isProcessing} />
      
      <GameMenu isOpen={showMenuModal} onClose={() => setShowMenuModal(false)} onExit={handleLeaveRoom} />

      <ChatMenu isOpen={showChatMenu} onClose={() => setShowChatMenu(false)} onSelectPhrase={handleSelectPhrase} />

      {isSeated && (
        <button 
          onClick={() => setShowChatMenu(true)}
          className="fixed z-40"
          style={{ 
            width: '35px', 
            height: '35px',
            bottom: '25%',
            left: '18px'
          }}
        >
          <img src={chatButton} alt="Chat" className="w-full h-full" />
        </button>
      )}

      {notification && <Notification type={notification} onClose={() => setNotification(null)} />}
      
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 1000 }}>
        {chipAnimations.map(chip => (
          <FlyingChip
            key={chip.id}
            chipId={chip.id}
            fromX={chip.fromX}
            fromY={chip.fromY}
            toX={chip.toX}
            toY={chip.toY}
            delay={chip.delay}
            onComplete={handleChipAnimationComplete}
          />
        ))}
      </div>
    </div>
  );
}