import { useState } from 'react';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { useTranslation } from 'react-i18next';
import { SlidePanelProps } from '@/types/components';

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
      className="shadow-lg rounded-b-lg p-2 mx-auto w-[93vw] relative"
      style={{
        boxShadow: '0px 5.5px 10px rgba(0, 0, 0, 0.25)',
        borderRadius: '0 0 8px 8px',
        background: '#48454D',
        position: 'relative',
        overflow: 'hidden',
        zIndex: 10,
        marginTop: '-5px'
      }}
    >
      <div className="relative z-10">
        <p 
          className="text-white text-center mb-2"
          style={{
            fontWeight: 600,
            fontStyle: 'normal',
            fontSize: '13px',
            lineHeight: '150%',
            letterSpacing: '-1.1%',
            verticalAlign: 'middle'
          }}
        >{t('show_only')}</p>
        <div
          className="p-1 rounded-lg relative"
          style={{
            boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.25)',
            borderRadius: '15px',
            width: '320px',
            margin: '0 auto',
            maxWidth: '320px',
            background: '#48454D',
            overflow: 'hidden',
            position: 'relative',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <div style={{ position: 'relative', height: '37px', width: '100%', zIndex: 10 }}>
            <Slider
              range
              min={0}
              max={1000000}
              value={rangeValues}
              onChange={handleRangeChange}
              railStyle={{ background: 'transparent', borderRadius: '15px', height: '37px' }}
              trackStyle={[{ background: '#807C7C', height: '4px', top: '50%', transform: 'translateY(-50%)', position: 'absolute', width: '261px', left: '50%', marginLeft: '-130.5px' }]}
              handleStyle={[
                { 
                  boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.25)', 
                  border: 'none', 
                  width: '20px', 
                  height: '20px', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  background: 'linear-gradient(0deg, #666666 0%, #FFFFFF 100%)',
                  opacity: 1
                },
                { 
                  boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.25)', 
                  border: 'none', 
                  width: '20px', 
                  height: '20px', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  background: 'linear-gradient(0deg, #666666 0%, #FFFFFF 100%)',
                  opacity: 1
                },
              ]}
              style={{ width: '100%', position: 'relative', height: '37px' }}
            />
          </div>
        </div>
        <div className="flex justify-around mt-2 mx-auto" style={{ width: '261px' }}>
          <span 
            className="text-white"
            style={{
              fontWeight: 600,
              fontStyle: 'normal',
              fontSize: '14px',
              lineHeight: '150%',
              letterSpacing: '-1.1%',
              verticalAlign: 'middle'
            }}
          >10</span>
          <span 
            className="text-white"
            style={{
              fontWeight: 600,
              fontStyle: 'normal',
              fontSize: '14px',
              lineHeight: '150%',
              letterSpacing: '-1.1%',
              verticalAlign: 'middle'
            }}
          >100</span>
          <span 
            className="text-white"
            style={{
              fontWeight: 600,
              fontStyle: 'normal',
              fontSize: '14px',
              lineHeight: '150%',
              letterSpacing: '-1.1%',
              verticalAlign: 'middle'
            }}
          >500</span>
          <span 
            className="text-white"
            style={{
              fontWeight: 600,
              fontStyle: 'normal',
              fontSize: '14px',
              lineHeight: '150%',
              letterSpacing: '-1.1%',
              verticalAlign: 'middle'
            }}
          >1K</span>
          <span 
            className="text-white"
            style={{
              fontWeight: 600,
              fontStyle: 'normal',
              fontSize: '14px',
              lineHeight: '150%',
              letterSpacing: '-1.1%',
              verticalAlign: 'middle'
            }}
          >10K</span>
          <span 
            className="text-white"
            style={{
              fontWeight: 600,
              fontStyle: 'normal',
              fontSize: '14px',
              lineHeight: '150%',
              letterSpacing: '-1.1%',
              verticalAlign: 'middle'
            }}
          >100K</span>
          <span 
            className="text-white"
            style={{
              fontWeight: 600,
              fontStyle: 'normal',
              fontSize: '14px',
              lineHeight: '150%',
              letterSpacing: '-1.1%',
              verticalAlign: 'middle'
            }}
          >1M</span>
        </div>
      </div>
    </div>
  );
}
