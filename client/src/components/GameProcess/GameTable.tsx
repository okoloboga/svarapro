import React from 'react';
import { GameState, Player } from '@/types/game';
import { PlayerSpot } from '@/components/PlayerSpot';

interface GameTableProps {
  gameState: GameState;
  currentUserId: string;
  showCards: boolean;
}

export function GameTable({ gameState, currentUserId, showCards }: GameTableProps) {
  // Расположение игроков по кругу
  const getPlayerPosition = (position: number, totalPlayers: number) => {
    // Вычисляем позиции для 6 мест (максимум)
    const positions = [
      'bottom-10 left-1/2 transform -translate-x-1/2', // нижний центр
      'bottom-1/4 right-1/4', // нижний правый
      'top-1/2 right-10 transform -translate-y-1/2', // правый центр
      'top-1/4 right-1/4', // верхний правый
      'top-10 left-1/2 transform -translate-x-1/2', // верхний центр
      'top-1/4 left-1/4', // верхний левый
      'top-1/2 left-10 transform -translate-y-1/2', // левый центр
      'bottom-1/4 left-1/4', // нижний левый
    ];
    
    // Если игроков меньше 6, выбираем позиции равномерно
    const step = Math.floor(positions.length / totalPlayers);
    return positions[position * step % positions.length];
  };

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
          className={`absolute ${getPlayerPosition(player.position, gameState.players.length)}`}
        >
          <PlayerSpot 
            player={player} 
            isCurrentPlayer={index === gameState.currentPlayerIndex}
            isCurrentUser={player.id === currentUserId}
            showCards={showCards || player.id === currentUserId && player.hasLooked}
          />
        </div>
      ))}
      
      {/* Дилер маркер */}
      {gameState.dealerIndex !== undefined && (
        <div 
          className={`absolute ${getPlayerPosition(gameState.players[gameState.dealerIndex]?.position, gameState.players.length)} mt-16 ml-16`}
        >
          <div className="bg-white text-black text-xs font-bold px-2 py-1 rounded-full">
            D
          </div>
        </div>
      )}
    </div>
  );
}
