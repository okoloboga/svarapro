
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

  return (
    <button 
      onClick={handleClick}
      className={`flex flex-col items-center justify-center bg-gray-800 bg-opacity-70 rounded-lg p-2 transition-all ${
        disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-opacity-90'
      }`}
      disabled={disabled}
    >
      <img 
        src={type === 'sitdown' ? sitdownImage : inviteImage} 
        alt={type === 'sitdown' ? 'Сесть' : 'Пригласить'} 
        className="w-12 h-12 mb-1"
      />
      <span className="text-white text-sm">
        {type === 'sitdown' ? 'Сесть' : 'Пригласить'}
      </span>
    </button>
  );
}
