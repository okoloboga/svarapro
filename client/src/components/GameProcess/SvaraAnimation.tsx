import { useEffect } from 'react';
import starIcon from '@/assets/game/star.png';

interface SvaraAnimationProps {
  onAnimationComplete: () => void;
}

export function SvaraAnimation({ onAnimationComplete }: SvaraAnimationProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onAnimationComplete();
    }, 2000); // Длительность анимации

    return () => clearTimeout(timer);
  }, [onAnimationComplete]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 pointer-events-none">
      <div className="animate-pulse-svara">
        <div className="flex items-center mx-4">
          <img src={starIcon} alt="*" className="w-12 h-12" />
          <h1 className="font-semibold text-5xl mx-4 text-white">Svara</h1>
          <img src={starIcon} alt="*" className="w-12 h-12" />
        </div>
      </div>
    </div>
  );
}
