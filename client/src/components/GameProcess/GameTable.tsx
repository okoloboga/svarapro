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

  const potContainerStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%) rotate(-90deg)',
    backgroundColor: 'rgba(19, 18, 23, 0.35)',
    width: '80px',
    height: '21px',
    borderRadius: '2px',
    border: '0.5px solid rgba(255, 255, 255, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
  };

  return (
    <div style={tableStyle}>
      <div style={potContainerStyle}>
        <span className="text-xs">Банк: ${gameState.pot}</span>
      </div>
    </div>
  );
};

export default GameTable;