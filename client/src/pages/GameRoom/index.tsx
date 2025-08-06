import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GameRoomProps } from '@/types/game';
import { initSocket } from '@/services/websocket';
import { useGameState } from '@/hooks/useGameState';
import { CardComponent } from '../../components/GameProcess/CardComponent';
import { GameTable } from '../../components/GameProcess/GameTable';
import { ActionButtons } from '../../components/GameProcess/ActionButton';
import { BetSlider } from '../../components/GameProcess/BetSlider';
import { GameInfo } from '../../components/GameProcess/GameInfo';

const socket = initSocket();

export function GameRoom({ roomId, balance }: GameRoomProps) {
  const { t } = useTranslation('common');
  const { gameState, loading, error, isSeated, actions } = useGameState(roomId);
  const [showBetSlider, setShowBetSlider] = useState(false);
  
  
  // ID текущего пользователя (получаем из Telegram Mini App)
  const currentUserId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() || '';
  
  useEffect(() => {
    return () => {
      socket.emit('leave_room', { roomId });
    };
  }, [roomId]);
  
  if (loading) {
    return (
      <div className="bg-primary min-h-screen flex flex-col items-center justify-center">
        <div className="text-white text-xl">Загрузка игры...</div>
      </div>
    );
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
        <div className="text-white text-xl">Игра не найдена</div>
      </div>
    );
  }
  
  // Находим текущего игрока
  const currentPlayer = gameState.players.find(p => p.id === currentUserId);
  
  // Определяем, чей сейчас ход
  const isCurrentUserTurn = isSeated && gameState.players[gameState.currentPlayerIndex]?.id === currentUserId;
  
  // Определяем возможные действия
  const canFold = isCurrentUserTurn && gameState.status !== 'showdown' && gameState.status !== 'finished';
  const canCheck = isCurrentUserTurn && gameState.status === 'betting' && (currentPlayer?.currentBet ?? 0) === gameState.currentBet;
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
    actions.sitDown(position);
  };
  
  return (
    <div className="bg-green-800 min-h-screen flex flex-col relative">
      {/* Заголовок */}
      <div className="bg-gray-900 text-white p-4 flex justify-between items-center">
        <h2 className="text-lg font-semibold">
          {t('game_room')} №{roomId.slice(0, 8)}
        </h2>
        <div>
          <span className="mr-2">Баланс: ${currentPlayer?.balance || balance}</span>
          <button 
            onClick={() => window.history.back()}
            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Выйти
          </button>
        </div>
      </div>
      
      {/* Игровой стол */}
      <div className="flex-grow relative p-4">
        <GameTable 
          gameState={gameState}
          currentUserId={currentUserId}
          showCards={showCards}
          onSitDown={handleSitDown}
          onInvite={actions.invitePlayer}
          maxPlayers={6}
        />
      </div>
      
      {/* Панель действий (показываем только если пользователь сидит за столом) */}
      {isSeated && (
        <div className="bg-gray-900 p-4">
          <div className="flex justify-between">
            {/* Информация об игре */}
            <div className="w-1/3">
              <GameInfo gameState={gameState} />
            </div>
            
            {/* Карты текущего игрока */}
            <div className="flex justify-center items-center space-x-2">
              {currentPlayer?.cards.map((card, index) => (
                <CardComponent 
                  key={index} 
                  card={currentPlayer.hasLooked ? card : undefined} 
                  hidden={!currentPlayer.hasLooked}
                  size="large" 
                />
              ))}
            </div>
            
            {/* Кнопки действий */}
            <div className="w-1/3">
              {isCurrentUserTurn ? (
                <ActionButtons 
                  canFold={canFold}
                  canCheck={canCheck}
                  canCall={canCall}
                  canRaise={canRaise}
                  canLook={canLook}
                  callAmount={callAmount}
                  onFold={actions.fold}
                  onCheck={actions.call} // Проверка - это по сути уравнивание нулевой ставки
                  onCall={actions.call}
                  onRaise={handleRaiseClick}
                  onLook={actions.lookCards}
                  currentBet={gameState.currentBet}
                  minRaise={minRaise}
                  maxRaise={maxRaise}
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
    </div>
  );
}