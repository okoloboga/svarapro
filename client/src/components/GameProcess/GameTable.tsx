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
  const baseWidth = 493;
  const baseHeight = 315;
  
  const tableStyle: React.CSSProperties = {
    width: `${baseWidth * scale}px`,
    
    height: `${baseHeight * scale}px`,
    borderRadius: `${149 * scale}px`,
    transform: 'rotate(90deg)',
    border: `${16 * scale}px solid #333238`,
    backgroundImage: `url(${tableImage})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    opacity: 1,
  };

  const tableClasses = "relative";

  // Стили для дополнительной рамки (65% от размера стола)
  // Учитываем поворот стола на 90 градусов
  const outerBorderStyle: React.CSSProperties = {
    width: `${baseHeight * scale * 0.65}px`, // Используем высоту стола как ширину рамки
    height: `${baseWidth * scale * 0.65}px`, // Используем ширину стола как высоту рамки
    borderRadius: `${164 * scale}px`,
    border: `${1 * scale}px solid rgba(158, 158, 159, 0.4)`, // #9E9E9F 40%
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none', // Чтобы рамка не мешала взаимодействию
  };

  const potContainerStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%) rotate(-90deg)',
    backgroundColor: 'rgba(19, 18, 23, 0.35)',
    width: `${80 * scale}px`,
    height: `${21 * scale}px`,
    borderRadius: `${2 * scale}px`,
    border: `${0.5 * scale}px solid rgba(255, 255, 255, 0.1)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
  };

  // Стили для надписи "Svarapro"
  const logoStyle: React.CSSProperties = {
    position: 'absolute',
    top: '70%', // 30% от низа = 70% от верха
    left: '50%',
    transform: 'translate(-50%, -50%) rotate(-90deg)', // Учитываем поворот стола
    color: 'rgba(255, 255, 255, 0.16)', // #FFFFFF 16%
    fontWeight: 800,
    fontStyle: 'normal',
    fontSize: `${20 * scale}px`,
    lineHeight: '100%',
    letterSpacing: '0%',
    textAlign: 'center',
    pointerEvents: 'none', // Чтобы текст не мешал взаимодействию
  };

  return (
    <div style={tableStyle} className={tableClasses}>
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
