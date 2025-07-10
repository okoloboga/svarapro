import { useState } from 'react';
import searchIcon from '../assets/search.svg';
import slideDownIcon from '../assets/slide-down.svg';
import { CSSTransition } from 'react-transition-group';
import { SlidePanel } from './SlidePanel';

type FilterProps = {
  onSearchChange: (searchId: string) => void;
  onAvailabilityChange: (isAvailable: boolean) => void;
  onRangeChange: (range: [number, number]) => void; // Новый пропс для диапазона ставок
};

export function Filter({ onSearchChange, onAvailabilityChange, onRangeChange }: FilterProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isToggleOn, setIsToggleOn] = useState(false);
  const [searchId, setSearchId] = useState('');

  const handleTogglePanel = () => {
    setIsPanelOpen((prev) => !prev);
  };

  const handleToggleSwitch = () => {
    const newToggleState = !isToggleOn;
    setIsToggleOn(newToggleState);
    onAvailabilityChange(newToggleState);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchId(value);
    onSearchChange(value);
  };

  return (
    <div className="mb-4 relative" style={{ zIndex: 10 }}>
      <div
        className="shadow-lg rounded-lg mx-auto mt-6 w-[336px] h-[50px] flex items-center p-2 relative"
        style={{
          boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)',
          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, #2D2B31 100%)',
          borderRadius: '8px',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: '1px',
            background: '#48454D',
            borderRadius: '8px',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
        <div className="relative w-[120px]">
          <input
            type="text"
            placeholder="Номер комнаты"
            value={searchId}
            onChange={handleSearchChange}
            className="w-full h-[30px] bg-[rgba(19,18,23,0.34)] p-2 pl-8 rounded-lg text-white text-center text-[10px]"
            style={{ boxShadow: 'inset 0px 0px 4px rgba(0, 0, 0, 0.25)', borderRadius: '6px' }}
          />
          <img
            src={searchIcon}
            alt="Search icon"
            className="absolute left-2 top-1/2 transform -translate-y-1/2 w-[22px] h-[22px]"
          />
        </div>
        <button
          className="flex flex-col items-center justify-center w-[100px] h-[34px] mx-2"
          style={{
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, #2D2B31 100%)',
            borderRadius: '8px',
            overflow: 'hidden',
            position: 'relative',
            zIndex: 10,
          }}
          onClick={handleTogglePanel}
        >
          <div
            style={{
              position: 'absolute',
              inset: '1px',
              background: '#48454D',
              borderRadius: '8px',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
          <span className="text-white text-[12px] leading-[16px] text-center z-20">Ставки</span>
          <img src={slideDownIcon} alt="Slide down icon" className="w-[15px] h-[7px] mt-1 z-20" />
        </button>
        <div className="flex items-center z-20">
          <span className="text-white text-[12px] mr-2">Доступны:</span>
          <div
            className="relative w-[40px] h-[20px] rounded-full flex items-center p-0.5 cursor-pointer"
            style={{ background: isToggleOn ? 'linear-gradient(180deg, #AF6600 0%, #FFC53F 100%)' : '#2F2E35' }}
            onClick={handleToggleSwitch}
          >
            <div
              className="w-[16px] h-[16px] bg-white rounded-full transition-all duration-300"
              style={{ transform: isToggleOn ? 'translateX(20px)' : 'translateX(0)' }}
            ></div>
          </div>
        </div>
      </div>
      <CSSTransition
        in={isPanelOpen}
        timeout={300}
        classNames="slide-panel"
        unmountOnExit
      >
        <SlidePanel isOpen={isPanelOpen} onClose={handleTogglePanel} onRangeChange={onRangeChange} />
      </CSSTransition>
    </div>
  );
}
