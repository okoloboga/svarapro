import { useState, useEffect, useCallback, useMemo } from 'react';

// Import sound files
import foldSoundSrc from '@/assets/game/fold.mp3';
import turnSoundSrc from '@/assets/game/turn.mp3';
import winSoundSrc from '@/assets/game/win.mp3';

export type SoundType = 'fold' | 'turn' | 'win';

export const useSound = () => {
  const [isSoundEnabled, setIsSoundEnabled] = useState(() => {
    const storedEnabled = localStorage.getItem('soundEnabled');
    return storedEnabled !== 'false'; // По умолчанию включено
  });

  // Слушаем изменения в localStorage для синхронизации между экземплярами
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'soundEnabled') {
        const newValue = e.newValue !== 'false';
        setIsSoundEnabled(newValue);
        console.log('Sound setting synced from storage:', newValue);
      }
    };

    // Также слушаем кастомное событие для синхронизации в рамках одной вкладки
    const handleSoundToggle = () => {
      const storedEnabled = localStorage.getItem('soundEnabled');
      const newValue = storedEnabled !== 'false';
      setIsSoundEnabled(newValue);
      console.log('Sound setting synced from custom event:', newValue);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('soundToggled', handleSoundToggle);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('soundToggled', handleSoundToggle);
    };
  }, []);

  const sounds = useMemo(() => ({
    fold: new Audio(foldSoundSrc),
    turn: new Audio(turnSoundSrc),
    win: new Audio(winSoundSrc),
  }), []);

  useEffect(() => {
    localStorage.setItem('soundEnabled', String(isSoundEnabled));
    console.log('Sound enabled changed to:', isSoundEnabled);
  }, [isSoundEnabled]);

  const playSound = useCallback((type: SoundType) => {
    console.log(`playSound called for: ${type}, soundEnabled: ${isSoundEnabled}`);
    
    if (!isSoundEnabled) {
      console.log(`Sound disabled, not playing: ${type}`);
      return;
    }
    
    try {
      const sound = sounds[type];
      if (sound) {
        sound.volume = 0.5; // Фиксированная громкость 50%
        sound.currentTime = 0;
        console.log(`Playing sound: ${type}`);
        sound.play().catch(error => console.error(`Error playing sound: ${type}`, error));
      }
    } catch (error) {
      console.error(`Error accessing sound: ${type}`, error);
    }
  }, [sounds, isSoundEnabled]);

  const toggleSound = useCallback(() => {
    setIsSoundEnabled(prev => {
      const newValue = !prev;
      // Отправляем кастомное событие для синхронизации других экземпляров хука
      window.dispatchEvent(new CustomEvent('soundToggled'));
      return newValue;
    });
  }, []);

  return { isSoundEnabled, toggleSound, playSound };
};
