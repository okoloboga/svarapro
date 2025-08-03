import { useState } from 'react';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { useTranslation } from 'react-i18next';

type SlidePanelProps = {
  isOpen: boolean;
  onClose: () => void;
  onRangeChange: (range: [number, number]) => void;
};

export function SlidePanel({ isOpen, onRangeChange }: SlidePanelProps) {
  const { t } = useTranslation('common');
  const [rangeValues, setRangeValues] = useState<[number, number]>([0, 1000000]);

  const handleRangeChange = (value: number | number[]) => {
    const newRange = Array.isArray(value) ? value as [number, number] : [0, 1000000];
    // Ограничиваем значения в пределах [0, 1000000] и гарантируем порядок
    const [minVal, maxVal] = [
      Math.max(0, Math.min(newRange[0], 1000000)),
      Math.max(0, Math.min(newRange[1], 1000000)),
    ].sort((a, b) => a - b) as [number, number];
    const validRange: [number, number] = [minVal, Math.max(minVal, maxVal)]; // Убеждаемся, что max >= min
    setRangeValues(validRange);
    onRangeChange(validRange); // Передаём родителю
  };

  if (!isOpen) return null;

  return (
    <div
      className="shadow-lg rounded-b-lg p-2 mx-auto w-[90vw] relative"
      style={{
        boxShadow: '0px 5.5px 10px rgba(0, 0, 0, 0.25)',
        borderRadius: '0 0 8px 8px',
        background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, #2D2B31 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '1px',
          background: '#48454D',
          borderRadius: '0 0 8px 8px',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <div className="relative z-10">
        <p className="text-white text-center mb-2">{t('show_only')}</p>
        <div
          className="p-1 rounded-lg relative"
          style={{
            boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.25)',
            borderRadius: '15px',
            width: '320px',
            margin: '0 auto',
            maxWidth: '320px',
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, #2D2B31 100%)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: '1px',
              background: '#48454D',
              borderRadius: '15px',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
          <div style={{ position: 'relative', height: '37px', width: '100%', zIndex: 10 }}>
            <Slider
              range
              min={0}
              max={1000000}
              value={rangeValues}
              onChange={handleRangeChange}
              railStyle={{ background: 'transparent', borderRadius: '15px', height: '37px' }}
              trackStyle={[{ background: '#807C7C', height: '4px', top: '50%', transform: 'translateY(-50%)', position: 'absolute', width: '290px', left: '50%', marginLeft: '-145px' }]}
              handleStyle={[
                { boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.25)', border: 'none', width: '20px', height: '20px', top: '60%', transform: 'translateY(-50%)' },
                { boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.25)', border: 'none', width: '20px', height: '20px', top: '60%', transform: 'translateY(-50%) translateX(-20px)' },
              ]}
              style={{ width: '100%', position: 'relative', height: '37px' }}
            />
          </div>
        </div>
        <div className="flex justify-around mt-2" style={{ width: '320px' }}>
          <span className="text-white">10</span>
          <span className="text-white">100</span>
          <span className="text-white">500</span>
          <span className="text-white">1K</span>
          <span className="text-white">10K</span>
          <span className="text-white">100K</span>
          <span className="text-white">1M</span>
        </div>
      </div>
    </div>
  );
}
