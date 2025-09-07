import { useLanguage } from '@/hooks/useLanguage';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';

const LANGUAGES = [
  { code: 'ru', labelKey: 'russian' },
  { code: 'en', labelKey: 'english' },
];

export function LanguageSelector({ onClose }: { onClose: () => void }) {
  const { currentLanguage, changeLanguage } = useLanguage();
  const { t } = useTranslation('common');
  const [pressed, setPressed] = useState<string | null>(null);

  const handleSelect = (code: string) => {
    if (currentLanguage !== code) {
      changeLanguage(code);
    }
    onClose();
  };

  return (
    <div
      className="animate-slide-up"
      style={{
        width: 270,
        height: 95,
        background: '#47444C',
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 5,
      }}
    >
      {LANGUAGES.map((lang) => {
        const isActive = currentLanguage === lang.code;
        const isPressed = pressed === lang.code;

        let background = 'none';
        if (isActive) {
          background = '#131217';
        } else if (isPressed) {
          background = '#bebebe'; // Darker for pressed
        }

        return (
          <div
            key={lang.code}
            style={{
              width: 260,
              height: 39,
              background: background,
              borderRadius: isActive ? 8 : 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 8,
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onClick={() => handleSelect(lang.code)}
            onMouseDown={() => setPressed(lang.code)}
            onMouseUp={() => setPressed(null)}
            onTouchStart={() => setPressed(lang.code)}
            onTouchEnd={() => setPressed(null)}
          >
            <span
              style={{
                fontWeight: 600,
                fontSize: 16,
                fontStyle: 'normal',
                lineHeight: '24px',
                letterSpacing: -0.5,
                color: '#fff',
                opacity: isActive ? 1 : 0.8,
                paddingLeft: 12,
                paddingRight: 12,
              }}
            >
              {t(lang.labelKey)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default LanguageSelector;
