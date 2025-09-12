import React from 'react';
import closeIcon from '../../assets/close.png';

interface SliderProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  height?: string; // e.g., '25vh', '300px'
  zIndex?: number;
}

export function Slider({ isOpen, onClose, children, height = '25vh', zIndex = 50 }: SliderProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 flex items-end`}
      style={{ zIndex }}
      onClick={onClose}
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        onTouchStart={(e) => e.preventDefault()}
        onTouchEnd={(e) => {
          e.preventDefault();
          onClose();
        }}
        className="absolute"
        style={{
          top: `calc(100vh - ${height} - 40px)`, // Position above the slider
          right: '20px',
          WebkitTapHighlightColor: 'transparent',
          touchAction: 'manipulation',
          zIndex: zIndex + 1,
        }}
      >
        <img src={closeIcon} alt="Close" style={{ width: '19px', height: '19px' }} />
      </button>

      {/* Bottom Sheet Panel */}
      <div
        className={`w-full transition-transform duration-300 ease-out ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ height }}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the panel
      >
        {/* Container with gradient border and rounded corners */}
        <div
          className="relative w-full h-full"
          style={{
            background: 'linear-gradient(180deg, #48454D 0%, rgba(255, 255, 255, 0.3) 50%, #2D2B31 100%)',
            boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)',
            borderRadius: '20px 20px 0 0',
          }}
        >
          {/* Inner background */}
          <div
            style={{
              position: 'absolute',
              inset: '1px',
              background: '#2E2B33',
              borderRadius: '19px',
              zIndex: 0,
            }}
          />
          
          {/* Content */}
          <div className="relative z-10 h-full">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}