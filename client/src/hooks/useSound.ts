import { useState, useEffect, useCallback, useMemo } from 'react';

// Import sound files
import foldSoundSrc from '@/assets/game/fold.mp3';
import turnSoundSrc from '@/assets/game/turn.mp3';
import winSoundSrc from '@/assets/game/win.mp3';

export type SoundType = 'fold' | 'turn' | 'win';

export const useSound = () => {
  const [volume, setVolume] = useState(() => {
    const storedVolume = localStorage.getItem('gameVolume');
    return storedVolume ? parseFloat(storedVolume) : 0.5; // Default volume 50%
  });

  const sounds = useMemo(() => ({
    fold: new Audio(foldSoundSrc),
    turn: new Audio(turnSoundSrc),
    win: new Audio(winSoundSrc),
  }), []);

  useEffect(() => {
    localStorage.setItem('gameVolume', String(volume));
    Object.values(sounds).forEach(sound => {
      sound.volume = volume;
    });
  }, [volume, sounds]);

  const playSound = useCallback((type: SoundType) => {
    try {
      const sound = sounds[type];
      if (sound) {
        sound.currentTime = 0;
        sound.play().catch(error => console.error(`Error playing sound: ${type}`, error));
      }
    } catch (error) {
      console.error(`Error accessing sound: ${type}`, error);
    }
  }, [sounds]);

  const handleSetVolume = useCallback((value: number) => {
    // value is from 0 to 100
    setVolume(value / 100);
  }, []);

  return { volume: Math.round(volume * 100), setVolume: handleSetVolume, playSound };
};
