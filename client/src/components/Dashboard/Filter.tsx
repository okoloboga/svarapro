import { useState } from 'react';
import { StyledContainer } from '../StyledContainer';
import { Button } from '../Button/Button';
import searchIcon from '../../assets/search.svg';
import slideDownIcon from '../../assets/slide-down.svg';
import { CSSTransition } from 'react-transition-group';
import { SlidePanel } from './SlidePanel';
import { useTranslation } from 'react-i18next';

type FilterProps = {
  onSearchChange: (searchId: string) => void;
  onAvailabilityChange: (isAvailable: boolean) => void;
  onRangeChange: (range: [number, number]) => void;
};

export function Filter({ onSearchChange, onAvailabilityChange, onRangeChange }: FilterProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isToggleOn, setIsToggleOn] = useState(false);
  const [searchId, setSearchId] = useState('');
  const { t } = useTranslation('common');

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
      <StyledContainer 
        className="mx-auto mt-6 w-[336px] h-[50px]"
        contentClassName="w-full h-full flex items-center justify-between p-2"
      >
        <div className="relative w-[120px]">
          <input
            type="text"
            placeholder={t('room_number')}
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
        <Button 
          layout="vertical" 
          icon={slideDownIcon} 
          iconPosition="right"
          iconClassName={`w-[15px] h-[7px] transition-transform duration-300 ${isPanelOpen ? 'rotate-180' : ''}`}
          onClick={handleTogglePanel} 
          className="w-[48px] h-[34px] mx-2 text-sm"
        >
          {t('stakes')}
        </Button>
        <div className="flex items-center">
          <span className="text-white text-[12px] mr-2">{t('available_colon')}</span>
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
      </StyledContainer>
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
