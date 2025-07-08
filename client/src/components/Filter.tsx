import { useState } from 'react';
import searchIcon from '../assets/search.svg';
import slideDownIcon from '../assets/slide-down.svg';
import { CSSTransition } from 'react-transition-group';
import { SlidePanel } from './SlidePanel';

export function Filter() {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isToggleOn, setIsToggleOn] = useState(false);

  const handleTogglePanel = () => {
    console.log('Before toggle, isPanelOpen:', isPanelOpen); // Отладка до переключения
    setIsPanelOpen((prev) => {
      const newValue = !prev;
      console.log('After toggle, isPanelOpen:', newValue); // Отладка после переключения
      return newValue;
    });
  };

  const handleToggleSwitch = () => {
    setIsToggleOn(!isToggleOn);
  };

  return (
    <div className="mb-4 relative" style={{ zIndex: 10 }}>
      <div
        className="bg-gradient-to-b from-[#36333B] via-[#46434B] to-[#48454D] shadow-lg rounded-lg mx-auto mt-6 w-[336px] h-[50px] flex items-center p-2"
        style={{ boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)' }}
      >
        <div className="relative w-[120px]">
          <input
            type="text"
            placeholder="Номер комнаты"
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
          className="bg-gradient-to-b from-[#36333B] via-[#46434B] to-[#48454D] shadow-lg rounded-lg flex flex-col items-center justify-center w-[100px] h-[34px] mx-2"
          style={{ boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)' }}
          onClick={handleTogglePanel}
        >
          <span className="text-white text-[12px] leading-[16px] text-center">Ставки</span>
          <img src={slideDownIcon} alt="Slide down icon" className="w-[15px] h-[7px] mt-1" />
        </button>
        <div className="flex items-center">
          <span className="text-white text-[12px] mr-2">Доступны:</span>
          <div
            className="relative w-[40px] h-[20px] rounded-full flex items-center p-0.5 cursor-pointer"
            style={{ background: isToggleOn ? 'linear-gradient(0deg, #AF6600 0%, #FFC53F 100%)' : '#2F2E35', transform: 'rotate(-180deg)' }}
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
        <SlidePanel isOpen={isPanelOpen} onClose={handleTogglePanel} />
      </CSSTransition>
    </div>
  );
}
