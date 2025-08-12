
import sitdownImage from '@/assets/game/sitdown.png';
import inviteImage from '@/assets/game/invite.png';

interface SeatButtonProps {
  type: 'sitdown' | 'invite';
  position: number;
  onSitDown: (position: number) => void;
  onInvite?: (position: number) => void;
  disabled?: boolean;
  scale?: number;
}

export function SeatButton({ type, position, onSitDown, onInvite, disabled, scale = 1 }: SeatButtonProps) {
  const handleClick = () => {
    if (disabled) return;
    if (type === 'sitdown') {
      onSitDown(position);
    } else if (onInvite) {
      onInvite(position);
    }
  };

  const baseWidth = type === 'sitdown' ? 71 : 71;
  const baseHeight = type === 'sitdown' ? 90 : 71;
  
  const buttonClasses = `
    transition-all duration-200 ease-in-out
    ${disabled ? 'opacity-50 cursor-not-allowed' : 'opacity-100 cursor-pointer hover:opacity-80'}
  `;

  const imageStyle: React.CSSProperties = {
    width: `${baseWidth * scale}px`,
    height: `${baseHeight * scale}px`,
  };

  return (
    <button 
      onClick={handleClick}
      className={buttonClasses}
      disabled={disabled}
    >
      <img 
        src={type === 'sitdown' ? sitdownImage : inviteImage} 
        alt={type === 'sitdown' ? 'Сесть' : 'Пригласить'} 
        style={imageStyle}
        className="object-contain"
      />
    </button>
  );
}
