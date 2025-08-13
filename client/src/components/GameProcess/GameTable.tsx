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
  scale?: number;
}

const GameTable: React.FC<GameTableProps> = ({ gameState, scale = 1 }) => {
  const baseWidth = 315;
  const baseHeight = 493;

  const containerStyle: React.CSSProperties = {
    width: `${baseWidth * scale}px`,
    height: `${baseHeight * scale}px`,
    borderRadius: `${149 * scale}px`,
    border: `${16 * scale}px solid #333238`,
    position: 'relative',
    overflow: 'hidden', // This is important to contain the rotated background
  };

  const backgroundStyle: React.CSSProperties = {
    position: 'absolute',
    width: `${baseHeight * scale}px`, // Swap width and height for rotation
    height: `${baseWidth * scale}px`, // Swap width and height for rotation
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%) rotate(90deg)',
    backgroundImage: `url(${tableImage})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };

  const tableClasses = "relative";

  // Стили для дополнительной рамки (65% от размера стола)
  const outerBorderStyle: React.CSSProperties = {
    width: `${baseWidth * scale * 0.65}px`,
    height: `${baseHeight * scale * 0.65}px`,
    borderRadius: `${164 * scale}px`,
    border: `${1 * scale}px solid rgba(158, 158, 159, 0.4)`, // #9E9E9F 40%
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none', // Чтобы рамка не мешала взаимодействию
    zIndex: 2,
  };

  const potContainerStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: 'rgba(19, 18, 23, 0.35)',
    width: `${80 * scale}px`,
    height: `${21 * scale}px`,
    borderRadius: `${2 * scale}px`,
    border: `${0.5 * scale}px solid rgba(255, 255, 255, 0.1)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    zIndex: 2,
  };

  // Стили для надписи "Svarapro"
  const logoStyle: React.CSSProperties = {
    position: 'absolute',
    top: '70%', // 30% от низа = 70% от верха
    left: '50%',
    transform: 'translate(-50%, -50%)',
    color: 'rgba(255, 255, 255, 0.16)', // #FFFFFF 16%
    fontWeight: 800,
    fontStyle: 'normal',
    fontSize: `${20 * scale}px`,
    lineHeight: '100%',
    letterSpacing: '0%',
    textAlign: 'center',
    pointerEvents: 'none', // Чтобы текст не мешал взаимодействию
    zIndex: 2,
  };

  return (
    <div style={containerStyle} className={tableClasses}>
      <div style={backgroundStyle}></div>
      
      {/* Дополнительная рамка вокруг стола */}
      <div style={outerBorderStyle}></div>
      
      {/* Надпись "Svarapro" */}
      <div style={logoStyle}>
        Svarapro
      </div>
      
      <div style={potContainerStyle}>
        <span className="text-xs" style={{ fontSize: `${12 * scale}px` }}>Банк: ${gameState.pot}</span>
      </div>
    </div>
  );
};

export default GameTable;
