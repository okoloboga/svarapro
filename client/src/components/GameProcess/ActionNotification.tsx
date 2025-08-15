import { useEffect, useState } from 'react';

interface ActionNotificationProps {
  action?: 'blind' | 'paid' | 'pass' | 'rais' | 'win' | null;
  visible: boolean;
  onHide: () => void;
}

// Placeholder configuration for styles and text. User will provide final values.
const actionConfig = {
  blind: { text: 'Blind', color: '#4B0082' }, // Indigo
  paid: { text: 'Paid', color: '#0000FF' },   // Blue
  pass: { text: 'Pass', color: '#808080' },   // Grey
  rais: { text: 'Raise', color: '#008000' },  // Green
  win: { text: 'Win', color: '#FFD700' },     // Gold
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
      <span className="text-white text-xs font-semibold">{config.text}</span>
    </div>
  );
}