import { useEffect, useState } from 'react';
import { GameRoomProps } from '@/types/game';
import { NotificationType } from '@/types/components';
import { Notification } from '@/components/Notification';
import { useGameState } from '@/hooks/useGameState';
import { CardComponent } from '../../components/GameProcess/CardComponent';
import GameTable from '../../components/GameProcess/GameTable';
import { ActionButtons } from '../../components/GameProcess/ActionButton';
import { BetSlider } from '../../components/GameProcess/BetSlider';
import { Socket } from 'socket.io-client';
import { LoadingPage } from '../../components/LoadingPage'; // Добавляем импорт
import { PlayerSpot } from '../../components/GameProcess/PlayerSpot';
import { SeatButton } from '../../components/GameProcess/SeatButton';

import { UserData, PageData } from '@/types/entities';
import { Page } from '@/types/page';

interface GameRoomPropsExtended extends GameRoomProps {
  socket: Socket | null;
  setCurrentPage: (page: Page, data?: Record<string, unknown>) => void;
  userData: UserData;
  pageData: PageData | null;
}

import backgroundImage from '../../assets/game/background.jpg';
import menuIcon from '../../assets/game/menu.svg';
import { GameMenu } from '../../components/GameProcess/GameMenu';

// Hook to get window size
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

// Хук для адаптивного позиционирования игроков
const useTablePositioning = () => {
  const [windowWidth] = useWindowSize();
  const [tableSize] = useState({ width: 315, height: 493 }); // base size of the table image

  const scale = windowWidth > 0 ? (windowWidth * 0.85) / tableSize.width : 0;

  const getPositionClasses = (position: number): string => {
    // Базовые классы для всех позиций
    const baseClasses = "absolute z-20 transition-all duration-300 ease-in-out hover:scale-105 hover:z-30 w-20 h-24 flex items-center justify-center";
    
    // Классы позиционирования в зависимости от позиции
    const positionClasses = {
      1: "-top-10 left-1/2",      // Top-center
      2: "top-1/4 -right-5",                       // Right-top (closer)
      3: "bottom-1/4 -right-5",                    // Right-bottom (closer)
      4: "-bottom-10 left-1/2",   // Bottom-center
      5: "bottom-1/4 -left-5",                     // Left-bottom (closer)
      6: "top-1/4 -left-5",                        // Left-top (closer)
    };
    
    return `${baseClasses} ${positionClasses[position as keyof typeof positionClasses] || ''}`;
  };

  const getPositionStyle = (position: number): React.CSSProperties => {
    let transform = `scale(${scale})`;
    if (position === 1 || position === 4) {
      transform += ' translateX(-50%)';
    }
    return {
      transform,
    };
  };

  return { getPositionStyle, getPositionClasses, scale };
};

export function GameRoom({ roomId, balance, socket, setCurrentPage, userData, pageData }: GameRoomPropsExtended) {
  const { gameState, loading, error, isSeated, actions } = useGameState(roomId, socket);
  const [showBetSlider, setShowBetSlider] = useState(false);
  const [showBlindBetSlider, setShowBlindBetSlider] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [notification, setNotification] = useState<NotificationType | null>(null);
  const { getPositionStyle, getPositionClasses, scale } = useTablePositioning();

  // ID текущего пользователя (получаем из Telegram Mini App)
  const currentUserId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() || '';

  useEffect(() => {
    if (socket) {
      console.log('Emitting join_room from GameRoom:', { roomId, currentUserId });
      socket.emit('join_room', { roomId });
    } else {
      console.error('Socket is not initialized in GameRoom');
    }

    return () => {
      if (socket) {
        console.log('Emitting leave_room from GameRoom:', { roomId });
        socket.emit('leave_room', { roomId });
      }
    };
  }, [roomId, socket, currentUserId]);

  useEffect(() => {
    if (pageData?.autoSit && !isSeated && gameState) {
      // Find first available seat
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

  if (loading) {
    return <LoadingPage isLoading={loading} />;
  }

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

  // Находим текущего игрока
  const currentPlayer = gameState.players.find(p => p.id === currentUserId);
  const currentUserPosition = currentPlayer?.position;

  const getScreenPosition = (absolutePosition: number) => {
    if (!currentUserPosition || !isSeated) {
      return absolutePosition; // Если пользователь не сидит, показываем абсолютные позиции
    }
    const offset = 4 - currentUserPosition;
    return ((absolutePosition + offset - 1 + 6) % 6) + 1;
  };
  
  // Определяем, чей сейчас ход
  const isCurrentUserTurn = isSeated && gameState.players[gameState.currentPlayerIndex]?.id === currentUserId;
  
  // Определяем возможные действия
  const canFold = isCurrentUserTurn && gameState.status === 'betting';
  
  const canCall = isCurrentUserTurn && gameState.status === 'betting' && (currentPlayer?.currentBet ?? 0) < gameState.currentBet;
  const canRaise = isCurrentUserTurn && gameState.status === 'betting' && (currentPlayer?.balance || 0) > 0;
  const canLook = isCurrentUserTurn && gameState.status === 'blind_betting';
  const canBlindBet = isCurrentUserTurn && gameState.status === 'blind_betting';
  const blindButtonsDisabled = gameState.status !== 'blind_betting';
  
  // Вычисляем суммы для ставок
  const callAmount = gameState.currentBet - (currentPlayer?.currentBet || 0);
  const minRaise = gameState.currentBet + gameState.minBet;
  const maxRaise = currentPlayer?.balance || 0;
  const hasEnoughBalance = parseFloat(balance) >= gameState.minBet * 3;
  
  // Определяем, показывать ли карты (в конце игры)
  const showCards = gameState.status === 'showdown' || gameState.status === 'finished';
  
  // Обработчик нажатия на кнопку "Повысить"
  const handleRaiseClick = () => {
    setShowBetSlider(true);
  };

  const handleBlindBetClick = () => {
    setShowBlindBetSlider(true);
  };
  
  // Обработчик подтверждения ставки
  const handleBetConfirm = (amount: number) => {
    actions.raise(amount);
    setShowBetSlider(false);
  };

  const handleBlindBetConfirm = (amount: number) => {
    actions.blindBet(amount);
    setShowBlindBetSlider(false);
  };
  
  // Обработчик нажатия на кнопку "Сесть"
  const handleSitDown = (position: number) => {
    console.log('handleSitDown called:', { 
      position, 
      balance: balance, 
      balanceNumber: parseFloat(balance), 
      minBet: gameState.minBet, 
      hasEnoughBalance,
      requiredBalance: gameState.minBet * 3 
    });
    
    if (!hasEnoughBalance) {
      setNotification('insufficientBalance');
      return;
    }
    actions.sitDown(position, userData);
  };

  const handleLeaveRoom = () => {
    // Закрываем все модальные окна
    setShowMenuModal(false);
    setShowBetSlider(false);
    
    // Выполняем выход из комнаты
    actions.leaveRoom();
    
    // Переходим на dashboard
    setCurrentPage('dashboard');
  };

  const handleMenuClick = () => {
    setShowMenuModal(true);
  };

  const handleCloseMenuModal = () => {
    setShowMenuModal(false);
  };

  const handleExitClick = () => {
    handleLeaveRoom();
  };

  const containerStyle = {
    backgroundImage: `url(${backgroundImage})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    minHeight: '100vh',
  };

  return (
    <div style={containerStyle} className="flex flex-col relative">
      {/* Заголовок */}
      <div className="text-white p-4 flex justify-between items-center">
        <h2 className="text-xs font-semibold">
          Комната №{roomId.slice(0, 8)}
        </h2>
        <div className="flex items-center space-x-3">
          <button 
            onClick={handleMenuClick}
            className="transition-all duration-200 ease-in-out hover:opacity-75"
          >
            <img 
              src={menuIcon} 
              alt="Меню" 
              className="w-5 h-5"
            />
          </button>
        </div>
      </div>
      
      {/* Игровой стол и места для игроков */}
      <div className="flex-grow relative p-4 z-10">
        {/* Центральный контейнер для стола и позиций игроков */}
        <div className="relative flex justify-center items-center min-h-[70vh] w-full p-4 sm:p-5 lg:p-6 game-table-container -mt-8">
          {/* Контейнер стола с позиционированием игроков */}
          <div className="relative flex justify-center items-center w-full h-full">
            {/* Игровой стол */}
            <div className="flex-shrink-0 relative z-10">
              <GameTable 
                gameState={gameState}
                currentUserId={currentUserId}
                showCards={showCards}
                onSitDown={handleSitDown}
                onInvite={actions.invitePlayer}
                maxPlayers={6}
                scale={scale}
              />
            </div>
            
            {/* Позиции игроков вокруг стола */}
            {
              Array.from({ length: 6 }).map((_, index) => {
                const absolutePosition = index + 1;
                const screenPosition = getScreenPosition(absolutePosition);
                const player = gameState.players.find(p => p.position === absolutePosition);
                const positionStyle = getPositionStyle(screenPosition);
                const positionClasses = getPositionClasses(screenPosition);

                return (
                  <div key={absolutePosition} style={positionStyle} className={positionClasses}>
                    {player ? (
                      (() => {
                        if (userData && userData.id && player.id.toString() === userData.id.toString()) {
                          const mergedPlayer = {
                            ...player,
                            username: userData.username || userData.first_name || player.username,
                            avatar: userData.photo_url || player.avatar,
                          };
                          return <PlayerSpot player={mergedPlayer} isCurrentUser={true} showCards={showCards} scale={scale} />;
                        }
                        return <PlayerSpot player={player} isCurrentUser={false} showCards={showCards} scale={scale} />;
                      })()
                    ) : (
                      <SeatButton 
                        type={isSeated ? 'invite' : 'sitdown'}
                        position={absolutePosition} // Pass absolute position for sitdown action
                        onSitDown={handleSitDown}
                        onInvite={() => {}} // Placeholder for invite functionality
                        scale={scale}
                      />
                    )}
                  </div>
                )
              })
            }
          </div>
        </div>
      </div>
      
      {/* Панель действий (показываем только если пользователь сидит за столом) */}
      {isSeated && (
        <div className="p-4">
          <div className="flex flex-col items-center space-y-4">
            {/* Карты текущего игрока - показываем только если игрок посмотрел карты или игра закончилась */}
            {(currentPlayer?.hasLooked || showCards) && (
              <div className="flex justify-center items-center space-x-2">
                {currentPlayer?.cards.map((card, index) => (
                  <CardComponent 
                    key={index} 
                    card={card}
                    hidden={false}
                    size="large" 
                    scale={scale}
                  />
                ))}
              </div>
            )}
            
            {/* Кнопки действий */}
            <div>
              {isCurrentUserTurn ? (
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
                  minBet={gameState.minBet}
                />
              ) : (
                <div className="bg-gray-800 text-white p-4 rounded-lg flex items-center justify-center h-full">
                  <p className="text-xl">Ожидание хода...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Модальное окно для ставки вслепую */}
      {showBlindBetSlider && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white text-xl font-bold">Ставка вслепую</h3>
              <button 
                onClick={() => setShowBlindBetSlider(false)}
                className="text-white text-2xl"
              >
                &times;
              </button>
            </div>
            <BetSlider 
              minBet={gameState.lastBlindBet * 2 || gameState.minBet}
              maxBet={maxRaise}
              initialBet={gameState.lastBlindBet * 2 || gameState.minBet}
              onConfirm={handleBlindBetConfirm}
            />
          </div>
        </div>
      )}
      
      {/* Модальное окно для повышения ставки */}
      {showBetSlider && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white text-xl font-bold">Повысить ставку</h3>
              <button 
                onClick={() => setShowBetSlider(false)}
                className="text-white text-2xl"
              >
                &times;
              </button>
            </div>
            <BetSlider 
              minBet={minRaise}
              maxBet={maxRaise}
              initialBet={minRaise}
              onConfirm={handleBetConfirm}
            />
          </div>
        </div>
      )}
      
      {/* Модальное окно меню */}
      <GameMenu 
        isOpen={showMenuModal}
        onClose={handleCloseMenuModal}
        onExit={handleExitClick}
      />
      {notification && <Notification type={notification} onClose={() => setNotification(null)} />}
    </div>
  );
}
