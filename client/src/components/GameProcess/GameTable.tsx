import React from 'react';
import tableImage from '../../assets/game/table.jpg';

const GameTable: React.FC = () => {
  const tableStyle: React.CSSProperties = {
    position: 'absolute',
    width: '493px',
    height: '315px',
    top: '121px',
    left: '30px',
    borderRadius: '149px',
    transform: 'rotate(90deg)',
    border: '16px solid #333238',
    backgroundImage: `url(${tableImage})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    opacity: 1,
  };

  return (
    <div style={tableStyle}>
      {/* Children can be passed here if needed */}
    </div>
  );
};

export default GameTable;