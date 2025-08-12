import { useEffect, useState, useRef } from 'react';
import { GameRoomProps } from '@/types/game';
import { useGameState } from '@/hooks/useGameState';
import { CardComponent } from '../../components/GameProcess/CardComponent';
import GameTable from '../../components/GameProcess/GameTable';
import { ActionButtons } from '../../components/GameProcess/ActionButton';
import { BetSlider } from '../../components/GameProcess/BetSlider';
import { Socket } from 'socket.io-client';
import { LoadingPage } from '../../components/LoadingPage'; // Добавляем импорт
import { PlayerSpot } from '../../components/GameProcess/PlayerSpot';
import { SeatButton } from '../../components/GameProcess/SeatButton';

interface GameRoomPropsExtended extends GameRoomProps {
  socket: Socket | null;
  setCurrentPage: (page: 'dashboard') => void;
  userData: any;
}

import backgroundImage from '../../assets/game/background.jpg';
import menuIcon from '../../assets/game/menu.svg';
import { GameMenu } from '../../components/GameProcess/GameMenu';

// Хук для адаптивного позиционирования игроков
const useTablePositioning = (containerRef: React.RefObject<HTMLDivElement>) => {
  const [tableSize] = useState({ width: 493, height: 315 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateSizes = () => {
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };

    updateSizes();
    window.addEventListener('resize', updateSizes);
    return () => window.removeEventListener('resize', updateSizes);
  }, [containerRef]);

  const getPositionClasses = (position: number): string => {
    // Базовые классы для всех позиций
    const baseClasses = "absolute z-10 transition-all duration-300 ease-in-out hover:scale-105 hover:z-20";
    
    // Классы позиционирования в зависимости от позиции
    // Учитываем поворот стола на 90 градусов
    const positionClasses = {
      1: "top-1/2 -translate-y-1/2 -left-24 sm:-left-28 md:-left-32 lg:-left-36", // Левая сторона повернутого стола
      2: "-top-24 sm:-top-28 md:-top-32 lg:-top-36 left-1/2 -translate-x-1/2", // Верхняя сторона повернутого стола
      3: "top-1/2 -translate-y-1/2 -right-24 sm:-right-28 md:-right-32 lg:-right-36", // Правая сторона повернутого стола
      4: "-bottom-24 sm:-bottom-28 md:-bottom-32 lg:-bottom-36 left-1/2 -translate-x-1/2", // Нижняя сторона повернутого стола
      5: "-bottom-24 sm:-bottom-28 md:-bottom-32 lg:-bottom-36 -left-24 sm:-left-28 md:-left-32 lg:-left-36", // Нижняя левая
      6: "-top-24 sm:-top-28 md:-top-32 lg:-top-36 -left-24 sm:-left-28 md:-left-32 lg:-left-36", // Верхняя левая
    };
    
    return `${baseClasses} ${positionClasses[position as keyof typeof positionClasses] || ''}`;
  };

  const getPositionStyle = (): React.CSSProperties => {
    // Масштабирующий коэффициент для адаптивности
    const scale = Math.min(containerSize.width / (tableSize.width + 300), containerSize.height / (tableSize.height + 300), 1);
    
    return {
      transform: `scale(${scale})`,
    };
  };

  return { getPositionStyle, getPositionClasses, scale: Math.min(containerSize.width / (tableSize.width + 200), containerSize.height / (tableSize.height + 200), 1) };
};

export function GameRoom({ roomId, balance, socket, setCurrentPage, userData }: GameRoomPropsExtended) {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const { gameState, loading, error, isSeated, actions } = useGameState(roomId, socket);
  const [showBetSlider, setShowBetSlider] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const { getPositionStyle, getPositionClasses, scale } = useTablePositioning(tableContainerRef);

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
  }, [roomId, socket]);

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
  
  // Определяем, чей сейчас ход
  const isCurrentUserTurn = isSeated && gameState.players[gameState.currentPlayerIndex]?.id === currentUserId;
  
  // Определяем возможные действия
  const canFold = isCurrentUserTurn && gameState.status !== 'showdown' && gameState.status !== 'finished';
  
  const canCall = isCurrentUserTurn && gameState.status === 'betting' && (currentPlayer?.currentBet ?? 0) < gameState.currentBet;
  const canRaise = isCurrentUserTurn && gameState.status === 'betting' && (currentPlayer?.balance || 0) > 0;
  const canLook = isCurrentUserTurn && gameState.status === 'blind_betting' && !currentPlayer?.hasLooked;
  const canBlindBet = isCurrentUserTurn && gameState.status === 'blind_betting' && !currentPlayer?.hasLooked;
  
  // Вычисляем суммы для ставок
  const callAmount = gameState.currentBet - (currentPlayer?.currentBet || 0);
  const minRaise = gameState.currentBet + gameState.minBet;
  const maxRaise = currentPlayer?.balance || 0;
  
  // Определяем, показывать ли карты (в конце игры)
  const showCards = gameState.status === 'showdown' || gameState.status === 'finished';
  
  // Обработчик нажатия на кнопку "Повысить"
  const handleRaiseClick = () => {
    setShowBetSlider(true);
  };
  
  
  
  // Обработчик подтверждения ставки
  const handleBetConfirm = (amount: number) => {
    actions.raise(amount);
    setShowBetSlider(false);
  };
  
  // Обработчик нажатия на кнопку "Сесть"
  const handleSitDown = (position: number) => {
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
          <span className="text-sm">Баланс: ${currentPlayer?.balance || balance}</span>
          <button 
            onClick={handleMenuClick}
            className="p-2 bg-gray-800 bg-opacity-50 hover:bg-opacity-70 rounded-lg transition-all duration-200 ease-in-out"
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
        <div ref={tableContainerRef} className="relative flex justify-center items-center min-h-[70vh] w-full p-4 sm:p-5 lg:p-6 game-table-container">
          {/* Контейнер стола с позиционированием игроков */}
          <div className="relative flex justify-center items-center w-full h-full">
            {/* Игровой стол */}
            <div className="flex-shrink-0 relative z-30">
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
                const position = index + 1;
                const player = gameState.players.find(p => p.position === position);
                const positionStyle = getPositionStyle();

                return (
                  <div key={position} style={positionStyle} className={getPositionClasses(position)}>
                    {player ? (
                      (() => {
                        if (player.id.toString() === userData.id.toString()) {
                          const mergedPlayer = {
                            ...player,
                            username: userData.username || player.username,
                            avatar: userData.photo_url || player.avatar,
                          };
                          return <PlayerSpot player={mergedPlayer} isCurrentUser={true} showCards={showCards} scale={scale} />;
                        }
                        return <PlayerSpot player={player} isCurrentUser={false} showCards={showCards} scale={scale} />;
                      })()
                    ) : (
                      <SeatButton 
                        type={isSeated ? 'invite' : 'sitdown'}
                        position={position}
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
          <div className="flex justify-between">
            {/* Карты текущего игрока */}
            <div className="flex justify-center items-center space-x-2">
              {currentPlayer?.cards.map((card, index) => (
                <CardComponent 
                  key={index} 
                  card={currentPlayer.hasLooked ? card : undefined} 
                  hidden={!currentPlayer.hasLooked}
                  size="large" 
                  scale={scale}
                />
              ))}
            </div>
            
            {/* Кнопки действий */}
            <div className="w-1/3">
              {isCurrentUserTurn ? (
                <ActionButtons 
                  canFold={canFold}
                  canCall={canCall}
                  canRaise={canRaise}
                  canLook={canLook}
                  callAmount={callAmount}
                  onFold={actions.fold}
                  onCall={actions.call}
                  onRaise={handleRaiseClick}
                  onLook={actions.lookCards}
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
      {canBlindBet && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full">
            <h3 className="text-white text-xl font-bold mb-4">Ставка вслепую</h3>
            <p className="text-gray-300 mb-4">
              Вы можете сделать ставку, не глядя на свои карты, или посмотреть карты.
            </p>
            <div className="space-y-4">
              <BetSlider 
                minBet={gameState.lastBlindBet * 2 || gameState.minBet}
                maxBet={maxRaise}
                initialBet={gameState.lastBlindBet * 2 || gameState.minBet}
                onConfirm={(amount) => actions.blindBet(amount)}
              />
              <div className="flex justify-center">
                <button
                  onClick={actions.lookCards}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Посмотреть карты
                </button>
              </div>
            </div>
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
    </div>
  );
}