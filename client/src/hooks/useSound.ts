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

  const sounds = useMemo(() => ({
    fold: new Audio(foldSoundSrc),
    turn: new Audio(turnSoundSrc),
    win: new Audio(winSoundSrc),
  }), []);

  useEffect(() => {
    localStorage.setItem('soundEnabled', String(isSoundEnabled));
  }, [isSoundEnabled]);

  const playSound = useCallback((type: SoundType) => {
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
    setIsSoundEnabled(prev => !prev);
  }, []);

  return { isSoundEnabled, toggleSound, playSound };
};
