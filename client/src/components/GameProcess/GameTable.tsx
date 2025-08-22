import React from 'react';
import { GameState } from '@/types/game';
import tableImage from '../../assets/game/table.jpg';
import ChipsStack from './ChipsStack';

interface GameTableProps {
  gameState: GameState;
  currentUserId: string;
  showCards: boolean;
  onSitDown: (position: number) => void;
  onInvite: () => void;
  onChatOpen: () => void;
  maxPlayers: number;
  scale?: number;
  showChipStack?: boolean;
  savedChipCount?: number;
}

const GameTable: React.FC<GameTableProps> = ({ 
  gameState, 
  scale = 1, 
  onChatOpen: _onChatOpen,
  showChipStack = true,
  savedChipCount = 0
}) => {
  const baseWidth = 315;
  const baseHeight = 493;
  
  // Подсчет общего количества фишек (каждая ставка = 1 фишка)
  // Фильтруем только действия текущего раунда
  // Используем gameState.round для определения текущего раунда
  const getCurrentRoundActions = () => {
    const actions = gameState.log;
    // Ищем последний 'win' action, который означает конец раунда
    let lastWinIndex = -1;
    for (let i = actions.length - 1; i >= 0; i--) {
      if (actions[i].type === 'win') {
        lastWinIndex = i;
        break;
      }
    }
    
    if (lastWinIndex === -1) {
      // Если нет 'win', берем все действия
      return actions;
    } else {
      // Берем действия после последнего 'win'
      return actions.slice(lastWinIndex + 1);
    }
  };
  
  const currentRoundActions = getCurrentRoundActions();
  const calculatedChips = currentRoundActions.filter((action: { type?: string }) => 
    action.type === 'ante' || 
    action.type === 'blind_bet' || 
    action.type === 'call' || 
    action.type === 'raise'
  ).length;
  
  // Используем сохраненное количество фишек если игра закончена, иначе считаем из логов
  const totalChips = gameState.status === 'finished' ? savedChipCount : calculatedChips;
  
  

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



  // Стили для надписи "налог 5%"
  const taxStyle: React.CSSProperties = {
    position: 'absolute',
    top: '54%', // Ближе к контейнеру банка
    left: '50%',
    transform: 'translate(-50%, -50%)',
    color: 'rgba(255, 255, 255, 0.6)', // #FFFFFF 60%
    fontWeight: 400,
    fontStyle: 'normal',
    fontSize: `${10 * scale}px`,
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
        <span className="text-xs" style={{ fontSize: `${12 * scale}px` }}>Банк: ${Number(gameState.pot).toFixed(2)}</span>
      </div>
      
      {/* Надпись "налог 5%" */}
      <div style={taxStyle}>
        налог 5%
      </div>
      
      {/* Стоп
      ки фишек */}
      {showChipStack && (
        <ChipsStack 
          totalChips={totalChips} 
          gameStatus={gameState.status}
          pot={gameState.pot}
        />
      )}
      
      {/* Отладочный лог для ChipStack */}
      {gameState.status === 'finished' && (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          color: 'white',
          fontSize: '10px',
          zIndex: 1000
        }}>
          showChipStack: {showChipStack.toString()}, totalChips: {totalChips}
        </div>
      )}
      

    </div>
  );
};

export default GameTable;
