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
import FlyingCard from '../../components/GameProcess/FlyingCard';
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

interface CardAnimation {
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
  const [cardAnimations, setCardAnimations] = useState<Array<CardAnimation>>([]);
  const [winSoundPlayed, setWinSoundPlayed] = useState(false);
  const [isDealingCards, setIsDealingCards] = useState(false);
  const [showFinished, setShowFinished] = useState(false);
  const [showChipStack, setShowChipStack] = useState(true);
  const [isAnteAnimationBlocked, setIsAnteAnimationBlocked] = useState(false);
  const [isFoldAnimationBlocked, setIsFoldAnimationBlocked] = useState(false);
  const [actualGameState, setActualGameState] = useState<GameState | null>(null);
  const [savedChipCount, setSavedChipCount] = useState(0);
  
  // Эффективное состояние игры с учетом блокировки анимаций
  const effectiveGameStatus = isAnteAnimationBlocked ? 'ante' : 
                             isFoldAnimationBlocked ? 'betting' : 
                             (gameState?.status || 'waiting');
  

  


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
  const isCurrentUserTurn = !!(isSeated && gameState && activeGamePhases.includes(effectiveGameStatus) && gameState.players[gameState.currentPlayerIndex]?.id === currentUserId && !gameState.isAnimating && !isProcessing);

  useEffect(() => {
    const activeTurn = gameState && activeGamePhases.includes(effectiveGameStatus) && !gameState.isAnimating;
    const currentPlayerId = gameState?.players[gameState?.currentPlayerIndex]?.id;
    const turnKey = `${gameState?.status}-${currentPlayerId}-${gameState?.currentPlayerIndex}`;



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
      console.log('🃏 New action in log:', lastAction);
      
      // Создаем уникальный ключ для действия
      const actionKey = `${lastAction.telegramId}-${lastAction.type}-${Date.now()}`;
      
      if (lastAction && 
          lastAction.telegramId !== currentUserId && 
          ['blind_bet', 'call', 'raise', 'ante'].includes(lastAction.type) &&
          actionKey !== lastProcessedActionRef.current) {
        lastProcessedActionRef.current = actionKey;
        handleOtherPlayerAction(lastAction.telegramId);
      }
      
      // Анимация сброса карт при fold
      if (lastAction && lastAction.type === 'fold') {
        setIsFoldAnimationBlocked(true); // Блокируем переход к finished
        handleFoldCards(lastAction.telegramId);
        
        // Разблокируем через 2 секунды (время анимации сброса карт)
        setTimeout(() => {
          console.log('🔄 Fold animation completed - unblocking finished state');
          setIsFoldAnimationBlocked(false);
        }, 2000);
      }
      
      // Анимация фишек для ante действий
      if (lastAction && lastAction.type === 'ante') {
        handlePlayerBet(lastAction.telegramId);
      }
      
      // Раздача карт в конце фазы ante (когда все игроки сделали ante)
      if (gameState.status === 'ante' && !isDealingCards) {
        const anteActions = gameState.log.filter(action => action.type === 'ante');
        const activePlayers = gameState.players.filter(player => player.isActive);
        
        if (anteActions.length >= activePlayers.length) {
          setIsDealingCards(true);
          // Добавляем задержку для завершения ante анимаций перед раздачей карт
          setTimeout(() => {
            handleDealCards();
          }, 1500); // 1.5 секунды для завершения всех ante анимаций
        }
      }
    }
    
    prevLogLengthRef.current = currentLogLength;
  }, [gameState?.log?.length, currentUserId, gameState?.status, isDealingCards]); // Добавляем зависимости

  // Функция для сброса карт при fold
  const handleFoldCards = (playerId: string) => {
    if (!gameState) return;
    
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return;
    
    // Показываем анимацию сброса карт даже для неактивных игроков (которые только что сбросили)
    if (!player.isActive && !player.hasFolded) return;
    
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const tableWidth = 315 * scale;
    const tableHeight = 493 * scale;
    const verticalOffset = 100;
    
    const isCurrentPlayer = player.id === currentUserId;
    const relativePosition = isCurrentPlayer ? 4 : getScreenPosition(player.position);
    
    // Вычисляем позицию игрока
    let playerX = 0;
    let playerY = 0;
    
    switch (relativePosition) {
      case 1: playerX = centerX; playerY = centerY - tableHeight * 0.4 - verticalOffset; break;
      case 2: playerX = centerX + tableWidth * 0.4; playerY = centerY - tableHeight * 0.25; break;
      case 3: playerX = centerX + tableWidth * 0.4; playerY = centerY + tableHeight * 0.25 - verticalOffset; break;
      case 4: playerX = centerX; playerY = centerY + tableHeight * 0.4 - verticalOffset; break;
      case 5: playerX = centerX - tableWidth * 0.4; playerY = centerY + tableHeight * 0.25 - verticalOffset; break;
      case 6: playerX = centerX - tableWidth * 0.4; playerY = centerY - tableHeight * 0.25; break;
    }
    
    // Создаем 3 карты для сброса
    for (let cardIndex = 0; cardIndex < 3; cardIndex++) {
      const cardId = `fold-${playerId}-${cardIndex}-${Date.now()}`;
      setCardAnimations(prev => [...prev, {
        id: cardId,
        fromX: playerX,
        fromY: playerY,
        toX: centerX,
        toY: centerY,
        delay: cardIndex * 100 // Небольшая задержка между картами
      }]);
    }
  };

  // Функция для анимации фишек к победителю
  const handleChipsToWinner = () => {
    console.log('🎯 WINNER: handleChipsToWinner called, savedChipCount:', savedChipCount, 'gameState.pot:', gameState?.pot);
    if (!gameState?.winners || gameState.winners.length === 0) {
      console.log('🎯 WINNER: No winners found');
      return;
    }
    
    // Если ничья - не запускаем анимацию (фишки остаются в банке)
    if (gameState.winners.length > 1) {
      console.log('🎯 WINNER: Multiple winners (tie) - chips stay in pot');
      return;
    }
    
    console.log('🎯 WINNER: Single winner found:', gameState.winners[0]);
    
    const winner = gameState.winners[0];
    const winnerPlayer = gameState.players.find(p => p.id === winner.id);
    
    if (!winnerPlayer) {
      return;
    }
    
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const tableWidth = 315 * scale;
    const tableHeight = 493 * scale;
    const verticalOffset = 100;
    
    const isCurrentPlayer = winnerPlayer.id === currentUserId;
    const relativePosition = isCurrentPlayer ? 4 : getScreenPosition(winnerPlayer.position);
    
    // Вычисляем позицию победителя
    let winnerX = 0;
    let winnerY = 0;
    
    switch (relativePosition) {
      case 1: winnerX = centerX; winnerY = centerY - tableHeight * 0.4 - verticalOffset; break;
      case 2: winnerX = centerX + tableWidth * 0.4; winnerY = centerY - tableHeight * 0.25; break;
      case 3: winnerX = centerX + tableWidth * 0.4; winnerY = centerY + tableHeight * 0.25 - verticalOffset; break;
      case 4: winnerX = centerX; winnerY = centerY + tableHeight * 0.4 - verticalOffset; break;
      case 5: winnerX = centerX - tableWidth * 0.4; winnerY = centerY + tableHeight * 0.25 - verticalOffset; break;
      case 6: winnerX = centerX - tableWidth * 0.4; winnerY = centerY - tableHeight * 0.25; break;
    }
    
    // Подсчитываем количество фишек в банке
    const chipCount = gameState.log.filter(action => 
      action.type === 'ante' || 
      action.type === 'blind_bet' || 
      action.type === 'call' || 
      action.type === 'raise'
    ).length;
    
    console.log('🎯 Creating', chipCount, 'chip animations to winner at position:', relativePosition);
    console.log('🎯 Winner coordinates:', winnerX, winnerY);
    
    // Создаем анимацию для каждой фишки
    for (let i = 0; i < chipCount; i++) {
      const chipId = `winner-chip-${Date.now()}-${i}`;
      console.log('🎯 Adding winner chip animation:', chipId);
      setChipAnimations(prev => [...prev, {
        id: chipId,
        fromX: centerX,
        fromY: centerY,
        toX: winnerX,
        toY: winnerY,
        delay: i * 50 // Небольшая задержка между фишками
      }]);
    }
  };

  // Play win sound for current user if they won (after finished state is shown)
  useEffect(() => {
    if (!gameState?.winners || !showFinished) {
      // Reset flags when game is not finished or not showing finished
      if (!showFinished) {
        setWinSoundPlayed(false);
      }

      return;
    }
    
    const currentUserWon = gameState.winners.some(winner => winner.id === currentUserId);
    if (currentUserWon && !winSoundPlayed) {
      // Play win sound immediately when finished state is shown
      const winSoundTimer = setTimeout(() => {
        actions.playSound('win');
        setWinSoundPlayed(true);
      }, 100);
      
      return () => clearTimeout(winSoundTimer);
    }
  }, [gameState?.winners, showFinished, currentUserId, actions, winSoundPlayed]);




  const handleChipAnimationComplete = useCallback((chipId: string) => {
    console.log('🎯 Chip animation completed:', chipId);
    setChipAnimations(prev => {
      const newAnimations = prev.filter(chip => chip.id !== chipId);
      console.log('🎯 Remaining chip animations:', newAnimations.length);
      
      // Скрываем ChipStack только если завершились анимации фишек к победителю
      const remainingWinnerChips = newAnimations.filter(chip => chip.id.startsWith('winner-chip-'));
      const hasWinnerChips = prev.some(chip => chip.id.startsWith('winner-chip-'));
      
      if (hasWinnerChips && remainingWinnerChips.length === 0) {
        console.log('🎯 All winner chip animations completed - hiding ChipStack');
        setTimeout(() => {
          setShowChipStack(false);
        }, 500); // Небольшая задержка перед скрытием
      }
      
      return newAnimations;
    });
  }, []);

  const handleCardAnimationComplete = useCallback((cardId: string) => {
    console.log('🃏 Card animation completed:', cardId);
    setCardAnimations(prev => {
      const newAnimations = prev.filter(card => card.id !== cardId);
      console.log('🃏 Remaining card animations:', newAnimations.length);
      return newAnimations;
    });
  }, []);

  // Логика блокировки ante анимаций
  useEffect(() => {
    if (!gameState) return;
    
    // Сохраняем актуальное состояние от сервера
    setActualGameState(gameState);
    
    // Если сервер переключился на blind_betting из ante, блокируем для ante анимаций
    if (gameState.status === 'blind_betting' && 
        (prevGameStatusRef.current === 'ante' || prevGameStatusRef.current === 'waiting') && 
        !isAnteAnimationBlocked) {
      console.log('🎯 Ante animation blocked - starting card deal');
      // Блокируем переход и остаемся в ante для завершения анимаций
      setIsAnteAnimationBlocked(true);
      
      // Запускаем раздачу карт после ante chip анимаций
      if (!isDealingCards) {
        console.log('🎯 Setting isDealingCards to true');
        setIsDealingCards(true);
        setTimeout(() => {
          console.log('🎯 Calling handleDealCards');
          handleDealCards();
        }, 1500); // Сначала ante chip анимации
      } else {
        console.log('🎯 Cards already being dealt, skipping');
      }
      
      setTimeout(() => {
        // Через 3 секунды разблокируем и переходим к blind_betting
        console.log('🎯 Unblocking ante animation');
        setIsAnteAnimationBlocked(false);
        // Сбрасываем флаг раздачи карт для следующей игры
        setIsDealingCards(false);
      }, 3000); // 3 секунды для полного завершения ante анимаций
      
      return;
    }
    
          // Если блокировка не активна, обновляем статус
      if (!isAnteAnimationBlocked) {
        prevGameStatusRef.current = gameState.status;
      }
      
            // Сбрасываем prevStatus когда fold анимация завершается, чтобы useEffect сработал снова
      if (prevGameStatusRef.current === 'finished' && !isFoldAnimationBlocked) {
        console.log('🔄 Resetting prevStatus from finished to empty for re-trigger');
        prevGameStatusRef.current = '';
        
        // Принудительно запускаем логику сохранения фишек после fold анимации
        const chipCount = gameState?.pot || 0;
        setSavedChipCount(chipCount);
        console.log('🎯 FORCED: Saved chip count after fold:', chipCount, 'pot:', gameState?.pot);
        setShowChipStack(true);
        
        setTimeout(() => {
          setShowFinished(true);
          setTimeout(() => {
            handleChipsToWinner();
          }, 2000);
        }, 1500);
      }
    }, [gameState?.status, isDealingCards, isAnteAnimationBlocked, isFoldAnimationBlocked]);

  // Раздача карт в конце фазы ante и управление показом finished
  const prevGameStatusRef = useRef<string>('');
  
  useEffect(() => {
    // Используем актуальное состояние только если нет блокировки ante
    const currentGameState = isAnteAnimationBlocked ? 
      { ...actualGameState!, status: 'ante' as const } : gameState;
    
    // Принудительно показываем ChipStack если есть фишки в банке
    if (gameState?.pot && gameState.pot > 0 && !showChipStack && gameState?.status !== 'finished') {
      console.log('🔄 Forcing ChipStack visibility - pot:', gameState.pot);
      setShowChipStack(true);
    }
    
    console.log('🔄 useEffect triggered:', {
      currentGameState: currentGameState?.status,
      prevStatus: prevGameStatusRef.current,
      isAnteAnimationBlocked,
      isFoldAnimationBlocked,
      gameStateStatus: gameState?.status,
      pot: gameState?.pot,
      showChipStack
    });
    
    if (currentGameState?.status && prevGameStatusRef.current !== currentGameState.status) {
      
            // Если переход к finished - добавляем задержку для завершения анимаций сброса карт
      if (currentGameState.status === 'finished' && !isFoldAnimationBlocked) {
        // Сохраняем количество фишек из текущего банка
        const chipCount = gameState?.pot || 0;
        setSavedChipCount(chipCount);
        console.log('🎯 FINISHED: Saved chip count:', chipCount, 'showChipStack:', showChipStack, 'pot:', gameState?.pot);
        // Оставляем ChipStack видимым для анимации фишек к победителю
        setShowChipStack(true);
        setTimeout(() => {
          setShowFinished(true);
          // Запускаем анимацию фишек к победителю после показа finished
          setTimeout(() => {
            handleChipsToWinner();
          }, 2000); // 2 секунды после показа finished для анимации фишек к победителю
        }, 1500); // 1.5 секунды для завершения анимаций сброса карт
      } else if (currentGameState.status === 'finished' && isFoldAnimationBlocked) {
        // Сохраняем количество фишек из текущего банка
        const chipCount = gameState?.pot || 0;
        setSavedChipCount(chipCount);
        console.log('🎯 FINISHED (fold blocked): Saved chip count:', chipCount, 'showChipStack:', showChipStack, 'pot:', gameState?.pot);
        // Не показываем finished пока идет fold анимация, но оставляем ChipStack
        setShowChipStack(true);
      } else {
        setShowFinished(false);
        // Сбрасываем состояния при переходе к waiting (новая игра)
        if (currentGameState.status === 'waiting') {
          console.log('🔄 Game reset to waiting - resetting all flags');
          setShowChipStack(true); // Показываем ChipStack для новой игры
          setIsDealingCards(false);
          setIsAnteAnimationBlocked(false); // Важно: сбрасываем блокировку ante
          setIsFoldAnimationBlocked(false); // Сбрасываем блокировку fold
          setSavedChipCount(0); // Сбрасываем сохраненное количество фишек
        }
      }
      
      // Если переход от waiting к ante - готовимся к раздаче карт
      if (prevGameStatusRef.current === 'waiting' && currentGameState.status === 'ante') {
        console.log('🔄 New game started - resetting flags');
        setShowChipStack(true); // Показываем ChipStack в новой игре
        setIsDealingCards(false); // Сбрасываем флаг раздачи карт
        setIsAnteAnimationBlocked(false); // Сбрасываем блокировку
        setIsFoldAnimationBlocked(false); // Сбрасываем блокировку fold
      }
      // Если переход от ante к blind_betting и нет блокировки - НЕ запускаем раздачу здесь (она уже запущена в блокировке)
      else if (prevGameStatusRef.current === 'ante' && currentGameState.status === 'blind_betting' && !isAnteAnimationBlocked) {
        // Ничего не делаем - раздача уже произошла через блокировку
      }
      // Если переход от waiting к blind_betting (пропущен ante) - запускаем раздачу карт
      else if (prevGameStatusRef.current === 'waiting' && currentGameState.status === 'blind_betting') {
        if (!isDealingCards && !isAnteAnimationBlocked) {
          console.log('🎯 Direct waiting -> blind_betting transition - starting card deal');
          setIsDealingCards(true);
          handleDealCards();
        } else {
          console.log('🎯 Skipping direct card deal - already handled by ante block');
        }
      }
      
      prevGameStatusRef.current = currentGameState.status;
    }
  }, [gameState?.status]);

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
  
  const canPerformBettingActions = !!(isCurrentUserTurn && effectiveGameStatus === 'betting' && !isAnimating && !postLookActions);
  const canPerformBlindActions = !!(isCurrentUserTurn && effectiveGameStatus === 'blind_betting' && !isAnimating && !postLookActions);

  const canFold = canPerformBettingActions || postLookActions;
  const canCall = canPerformBettingActions || postLookActions;
  const canRaise = canPerformBettingActions || postLookActions;
  const canLook = canPerformBlindActions;
  const canBlindBet = canPerformBlindActions;

  const isCallDisabled = !!(effectiveGameStatus === 'betting' || effectiveGameStatus === 'blind_betting'
    ? false
    : (currentPlayer?.currentBet ?? 0) >= gameState.currentBet);
  const isRaiseDisabled = !!((currentPlayer?.balance || 0) < minRaiseAmount);
  const isBlindBetDisabled = !!((currentPlayer?.balance || 0) < blindBetAmount);
  
  const blindButtonsDisabled = !!(effectiveGameStatus !== 'blind_betting');
  
  const showCards = !!(effectiveGameStatus === 'showdown' || (effectiveGameStatus === 'finished' && showFinished) || gameState.showWinnerAnimation);

  // Обработчик для анимации действий других игроков
  const handleOtherPlayerAction = (playerId: string) => {
    handlePlayerBet(playerId);
  };

  // Функция для раздачи карт от центра стола к игрокам
  const handleDealCards = () => {
    console.log('🃏 handleDealCards called');
    
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const tableWidth = 315 * scale;
    const tableHeight = 493 * scale;
    const verticalOffset = 100;
    
    // Раздаем по 3 карты каждому активному игроку
    gameState.players.forEach((player, playerIndex) => {
      if (!player.isActive) return;
      
      const isCurrentPlayer = player.id === currentUserId;
      const relativePosition = isCurrentPlayer ? 4 : getScreenPosition(player.position);
      
      // Вычисляем позицию игрока
      let playerX = 0;
      let playerY = 0;
      
      switch (relativePosition) {
        case 1: playerX = centerX; playerY = centerY - tableHeight * 0.4 - verticalOffset; break;
        case 2: playerX = centerX + tableWidth * 0.4; playerY = centerY - tableHeight * 0.25; break;
        case 3: playerX = centerX + tableWidth * 0.4; playerY = centerY + tableHeight * 0.25 - verticalOffset; break;
        case 4: playerX = centerX; playerY = centerY + tableHeight * 0.4 - verticalOffset; break;
        case 5: playerX = centerX - tableWidth * 0.4; playerY = centerY + tableHeight * 0.25 - verticalOffset; break;
        case 6: playerX = centerX - tableWidth * 0.4; playerY = centerY - tableHeight * 0.25; break;
      }
      
      // Создаем 3 карты для каждого игрока
      for (let cardIndex = 0; cardIndex < 3; cardIndex++) {
        const cardId = `deal-${player.id}-${cardIndex}-${Date.now()}`;
        setCardAnimations(prev => [...prev, {
          id: cardId,
          fromX: centerX,
          fromY: centerY,
          toX: playerX,
          toY: playerY,
          delay: (playerIndex * 3 + cardIndex) * 200 // Задержка для последовательной раздачи
        }]);
      }
    });
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
        playerY = centerY - tableHeight * 0.25; // Поднимаем выше
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
        playerY = centerY - tableHeight * 0.25; // Поднимаем выше
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
                showChipStack={showChipStack}
                savedChipCount={savedChipCount}
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
                            gameStatus={effectiveGameStatus}
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
                          gameStatus={effectiveGameStatus}
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
              {effectiveGameStatus === 'waiting' ? (
                <div className="p-4 flex items-center justify-center h-full">
                  <p className="text-white font-bold text-[10px] leading-[150%] tracking-[-0.011em] text-center">Ждем игроков</p>
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
                  minBet={effectiveGameStatus === 'blind_betting' ? blindBetAmount : minRaiseAmount}
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
        {cardAnimations.map(card => (
          <FlyingCard
            key={card.id}
            cardId={card.id}
            fromX={card.fromX}
            fromY={card.fromY}
            toX={card.toX}
            toY={card.toY}
            delay={card.delay}
            onComplete={handleCardAnimationComplete}
          />
        ))}
      </div>
    </div>
  );
}