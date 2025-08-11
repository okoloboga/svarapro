import React from 'react';
import { GameState } from '@/types/game';
import tableImage from '../../assets/game/table.jpg';

interface GameTableProps {
  gameState: GameState;
  currentUserId: string;
  showCards: boolean;
  onSitDown: (position: number) => void;
  onInvite: () => void;
  maxPlayers: number;
}

const GameTable: React.FC<GameTableProps> = ({ gameState }) => {
  const tableStyle: React.CSSProperties = {
    width: '493px',
    height: '315px',
    borderRadius: '149px',
    transform: 'rotate(90deg)',
    border: '16px solid #333238',
    backgroundImage: `url(${tableImage})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    opacity: 1,
    position: 'relative',
  };

  const potStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%) rotate(-90deg)',
    textAlign: 'center',
    color: 'white',
  };

  return (
    <div style={tableStyle}>
      <div style={potStyle}>
        <h3 className="text-lg font-semibold">Банк</h3>
        <p className="text-2xl font-bold text-green-400">${gameState.pot}</p>
      </div>
    </div>
  );
};

export default GameTable;