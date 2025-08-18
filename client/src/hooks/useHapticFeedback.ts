import { useState, useEffect, useCallback } from 'react';
import { hapticFeedback } from '@telegram-apps/sdk';
import { isTMA } from '@telegram-apps/sdk-react';

export const useHapticFeedback = () => {
  const [isEnabled, setIsEnabled] = useState(() => {
    const storedValue = localStorage.getItem('hapticEnabled');
    return storedValue !== 'false'; // По умолчанию включено
  });

  useEffect(() => {
    localStorage.setItem('hapticEnabled', String(isEnabled));
  }, [isEnabled]);

  const toggleHaptic = useCallback(() => {
    setIsEnabled(prev => !prev);
  }, []);

  const triggerImpact = useCallback((style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => {
    console.log('triggerImpact called:', { 
      style, 
      isEnabled, 
      isTMA: isTMA(), 
      isSupported: hapticFeedback.isSupported(),
      isAvailable: hapticFeedback.impactOccurred.isAvailable()
    });
    
    if (isEnabled && isTMA() && hapticFeedback.impactOccurred.isAvailable()) {
      try {
        hapticFeedback.impactOccurred(style);
        console.log('Haptic feedback triggered successfully');
      } catch (error) {
        console.error('Error triggering haptic feedback:', error);
      }
    } else {
      console.log('Haptic feedback not triggered:', { 
        isEnabled, 
        isTMA: isTMA(), 
        isSupported: hapticFeedback.isSupported(),
        isAvailable: hapticFeedback.impactOccurred.isAvailable()
      });
    }
  }, [isEnabled]);

  return { isHapticEnabled: isEnabled, toggleHaptic, triggerImpact };
};
