import React, { useEffect, useState } from 'react';

// Импортируем изображения уведомлений
import blindImage from '@/assets/game/blind.png';
import paidImage from '@/assets/game/paid.png';
import passImage from '@/assets/game/pass.png';
import raisImage from '@/assets/game/rais.png';
import winImage from '@/assets/game/win.png';

interface ActionNotificationProps {
  action?: 'blind' | 'paid' | 'pass' | 'rais' | 'win' | null;
  visible: boolean;
  onHide: () => void;
}

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

  if (!action || !isVisible) return null;

  const getActionImage = () => {
    switch (action) {
      case 'blind': return blindImage;
      case 'paid': return paidImage;
      case 'pass': return passImage;
      case 'rais': return raisImage;
      case 'win': return winImage;
      default: return null;
    }
  };

  return (
    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-full z-10 transition-opacity duration-300" 
         style={{ opacity: isVisible ? 1 : 0 }}>
      <img src={getActionImage()} alt={action} className="w-16 h-16" />
    </div>
  );
}
