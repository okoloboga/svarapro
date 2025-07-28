import { Button } from '../Button/Button';
import createIcon from '../../assets/create.png';
import tournamentsIcon from '../../assets/tournaments.png';
import moreIcon from '../../assets/more.png';

type ButtonGroupProps = {
  onMoreClick: () => void; // Пропс для обработки клика на "Ещё"
  onComingSoonClick: () => void;
};

export function ButtonGroup({ onMoreClick, onComingSoonClick }: ButtonGroupProps) {
  return (
    <div className="flex items-center gap-2 mx-auto mt-6 w-[336px]">
      <Button layout="vertical" icon={createIcon} className="flex-1 h-[57px]">Создать</Button>
      <Button layout="vertical" icon={tournamentsIcon} className="flex-1 h-[57px]" onClick={onComingSoonClick}>Турниры</Button>
      <Button layout="vertical" icon={moreIcon} onClick={onMoreClick} className="flex-1 h-[57px]">Ещё</Button>
    </div>
  );
}
