import React from 'react';

type StyledContainerProps = {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  isActive?: boolean; // Новый пропс для активного состояния
} & React.HTMLAttributes<HTMLDivElement>;

export function StyledContainer({ 
  children, 
  className = '', 
  contentClassName = 'w-full h-full flex items-center justify-center',
  isActive = false, // По умолчанию неактивен
  ...rest 
}: StyledContainerProps) {

  const innerBackground = isActive ? '#2E2B33' : '#48454D';

  return (
    <div
      className={`relative box-border overflow-hidden text-white ${className}`}
      style={{
        background: 'linear-gradient(180deg, #48454D 0%, rgba(255, 255, 255, 0.3) 50%, #2D2B31 100%)',
        boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)',
        borderRadius: '8px',
        ...rest.style,
      }}
      {...rest}
    >
      {/* Внутренний фон */}
      <div
        style={{
          position: 'absolute',
          inset: '1px',
          background: innerBackground,
          borderRadius: '8px',
          zIndex: 0,
        }}
      />
      {/* Контейнер для контента */}
      <div className={`relative z-10 ${contentClassName}`}>
        {children}
      </div>
    </div>
  );
}
