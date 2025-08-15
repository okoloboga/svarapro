import { useEffect, useState } from 'react';

interface ActionNotificationProps {
  action?: 'blind' | 'paid' | 'pass' | 'rais' | 'win' | null;
  visible: boolean;
  onHide: () => void;
}

// Final configuration for styles and text.
const actionConfig = {
  blind: { text: 'ВСЛЕПУЮ', color: '#0E5C89' },
  paid: { text: 'ОПЛАТИЛ', color: '#0E5C89' },
  pass: { text: 'ПАС', color: '#FF3131' },
  rais: { text: 'ПОВЫСИЛ', color: '#56BF00' },
  win: { text: 'ВЫИГРАЛ', color: '#56BF00' },
};

export function ActionNotification({ action, visible, onHide }: ActionNotificationProps) {
  const [isVisible, setIsVisible] = useState(visible);

  useEffect(() => {
    setIsVisible(visible);
    if (visible) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onHide();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [visible, onHide]);

  if (!action || !isVisible) {
    return null;
  }

  const config = actionConfig[action];

  return (
    <div 
      className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-full z-10 transition-opacity duration-300 flex items-center justify-center"
      style={{ 
        opacity: isVisible ? 1 : 0,
        width: '62px',
        height: '18px',
        borderRadius: '4px',
        backgroundColor: config.color,
      }}
    >
      <span className="text-white text-[10px] font-extrabold leading-none text-center">{config.text}</span>
    </div>
  );
}