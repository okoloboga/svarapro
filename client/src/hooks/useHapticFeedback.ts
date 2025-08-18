import { useState, useEffect, useCallback } from 'react';
import { hapticFeedback, isTMA } from '@telegram-apps/sdk';

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
    if (isEnabled && isTMA()) {
      hapticFeedback.impactOccurred(style);
    }
  }, [isEnabled]);

  return { isHapticEnabled: isEnabled, toggleHaptic, triggerImpact };
};
