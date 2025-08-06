
import { GameState } from '@/types/game';
import { PlayerSpot } from './PlayerSpot';
import { SeatButton } from './SeatButton';

interface GameTableProps {
  gameState: GameState;
  currentUserId: string;
  showCards: boolean;
  onSitDown: (position: number) => void;
  onInvite?: (position: number) => void;
  maxPlayers: number;
}

export function GameTable({ 
  gameState, 
  currentUserId, 
  showCards, 
  onSitDown, 
  onInvite,
  maxPlayers = 6
}: GameTableProps) {
  // Расположение игроков по кругу
  const getPlayerPosition = (position: number) => {
    // Вычисляем позиции для 6 мест (максимум)
    const positions = [
      'bottom-10 left-1/2 transform -translate-x-1/2', // нижний центр
      'bottom-1/4 right-1/4', // нижний правый
      'top-1/2 right-10 transform -translate-y-1/2', // правый центр
      'top-1/4 right-1/4', // верхний правый
      'top-10 left-1/2 transform -translate-x-1/2', // верхний центр
      'top-1/4 left-1/4', // верхний левый
    ];
    
    return positions[position % positions.length];
  };

  // Проверяем, сидит ли текущий пользователь за столом
  const isUserSeated = gameState.players.some(p => p.id === currentUserId);
  
  // Получаем занятые позиции
  const occupiedPositions = gameState.players.map(p => p.position);
  
  // Получаем свободные позиции
  const freePositions = Array.from({ length: maxPlayers }, (_, i) => i)
    .filter(pos => !occupiedPositions.includes(pos));

  return (
    <div className="relative w-full h-full bg-green-800 rounded-full shadow-inner overflow-hidden">
      {/* Фон стола */}
      <div className="absolute inset-0 bg-gradient-to-br from-green-700 to-green-900 opacity-50" />
      
      {/* Центр стола с банком */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-green-700 rounded-full w-48 h-48 flex items-center justify-center shadow-lg">
        <div className="text-center">
          <div className="text-white text-xl font-bold">Банк</div>
          <div className="text-yellow-400 text-3xl font-bold">${gameState.pot}</div>
          
          {/* Статус игры */}
          <div className="mt-2 text-white text-sm">
            {gameState.status === 'waiting' && 'Ожидание игроков'}
            {gameState.status === 'ante' && 'Входные ставки'}
            {gameState.status === 'blind_betting' && 'Ставки вслепую'}
            {gameState.status === 'betting' && 'Торги'}
            {gameState.status === 'showdown' && 'Вскрытие карт'}
            {gameState.status === 'svara' && 'Свара!'}
            {gameState.status === 'finished' && 'Игра завершена'}
          </div>
          
          {/* Текущая ставка */}
          {gameState.currentBet > 0 && (
            <div className="mt-1 text-white text-sm">
              Текущая ставка: ${gameState.currentBet}
            </div>
          )}
        </div>
      </div>
      
      {/* Игроки вокруг стола */}
      {gameState.players.map((player, index) => (
        <div 
          key={player.id} 
          className={`absolute ${getPlayerPosition(player.position)}`}
        >
          <PlayerSpot 
            player={player} 
            isCurrentPlayer={index === gameState.currentPlayerIndex}
            isCurrentUser={player.id === currentUserId}
            showCards={showCards}
          />
        </div>
      ))}
      
      {/* Свободные места */}
      {freePositions.map(position => (
        <div 
          key={`seat-${position}`} 
          className={`absolute ${getPlayerPosition(position)}`}
        >
          <SeatButton 
            type={!isUserSeated ? 'sitdown' : 'invite'} 
            position={position} 
            onSitDown={onSitDown} 
            onInvite={onInvite}
            disabled={!onInvite}
          />
        </div>
      ))}
      
      {/* Дилер маркер */}
      {gameState.dealerIndex !== undefined && gameState.players[gameState.dealerIndex] && (
        <div 
          className={`absolute ${getPlayerPosition(gameState.players[gameState.dealerIndex].position)} mt-16 ml-16`}
        >
          <div className="bg-white text-black text-xs font-bold px-2 py-1 rounded-full">
            D
          </div>
        </div>
      )}
    </div>
  );
}
