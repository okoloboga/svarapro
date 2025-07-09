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
      className="shadow-lg rounded-lg flex flex-col items-center justify-center w-[98px] h-[57px] relative"
      style={{
        boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)',
        background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, #2D2B31 100%)', // Градиент как бордер
        overflow: 'hidden', // Чтобы псевдоэлемент не выходил за границы
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '1px', // Толщина бордера 1px
          background: '#46434B', // Сплошной фон внутри, совпадает с оригинальным
          borderRadius: '8px', // Закругление внутреннего слоя
          pointerEvents: 'none', // Чтобы не перекрывал кликабельные элементы
          zIndex: 0,
        }}
      />
      <img src={icon} alt={`${label} icon`} className="w-[24px] h-[24px] -mb-2 relative z-10" />
      <span className="text-white text-center relative z-10">{label}</span>
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
