
import sitdownImage from '@/assets/game/sitdown.png';
import inviteImage from '@/assets/game/invite.png';

interface SeatButtonProps {
  type: 'sitdown' | 'invite';
  position: number;
  onSitDown: (position: number) => void;
  onInvite?: (position: number) => void;
  disabled?: boolean;
}

export function SeatButton({ type, position, onSitDown, onInvite, disabled }: SeatButtonProps) {
  const handleClick = () => {
    if (disabled) return;
    if (type === 'sitdown') {
      onSitDown(position);
    } else if (onInvite) {
      onInvite(position);
    }
  };

  const imageClass = type === 'sitdown' ? 'w-[71px] h-[90px]' : 'w-[71px] h-[71px]';

  return (
    <button 
      onClick={handleClick}
      className={`transition-all ${
        disabled ? 'cursor-not-allowed opacity-50' : 'hover:opacity-80'
      }`}
      disabled={disabled}
    >
      <img 
        src={type === 'sitdown' ? sitdownImage : inviteImage} 
        alt={type === 'sitdown' ? 'Сесть' : 'Пригласить'} 
        className={imageClass}
      />
    </button>
  );
}
