import createIcon from '../assets/create.png';
import tournamentsIcon from '../assets/tournaments.png';
import moreIcon from '../assets/more.png';

type ButtonProps = {
  icon: string;
  label: string;
};

function Button({ icon, label }: ButtonProps) {
  return (
    <button
      className="bg-[#46434B] shadow-lg rounded-lg flex flex-col items-center justify-center w-[98px] h-[57px]"
      style={{ boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)' }}
    >
      <img src={icon} alt={`${label} icon`} className="w-[24px] h-[24px] -mb-2" />
      <span className="text-white text-center">{label}</span>
    </button>
  );
}

export function ButtonGroup() {
  return (
    <div className="flex justify-between mx-auto mt-6 w-[336px]">
      <Button icon={createIcon} label="Создать" />
      <Button icon={tournamentsIcon} label="Турниры" />
      <Button icon={moreIcon} label="Ещё" />
    </div>
  );
}
