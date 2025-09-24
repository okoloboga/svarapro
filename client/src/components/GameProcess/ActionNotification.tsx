import { useTranslation } from 'react-i18next';

interface ActionNotificationProps {
  action?: 'blind' | 'paid' | 'pass' | 'rais' | 'win' | 'look' | null;
  visible: boolean;
  maxWidth?: number;   // <- добавили: ограничиваем ширину бейджа
  scale?: number;      // <- добавили: масштабируем размеры
}

export function ActionNotification({ action, visible, maxWidth, scale = 1 }: ActionNotificationProps) {
  const { t } = useTranslation('common');

  const actionConfig = {
    blind: { text: t('blind_action'), color: '#0E5C89' },
    paid:  { text: t('paid_action'),  color: '#0E5C89' },
    pass:  { text: t('pass_action'),  color: '#FF3131' },
    rais:  { text: t('raise_action'), color: '#56BF00' },
    win:   { text: t('win_action'),   color: '#56BF00' },
    look:  { text: t('look_action'),  color: '#0E5C89' },
  } as const;

  if (!action || !visible) return null;
  const config = actionConfig[action];

  const H  = 18 * scale;      // пониже, чтобы не раздувать фон
  const PX = 6  * scale;      // горизонтальный паддинг
  const R  = 6  * scale;      // радиус
  const FS = 10 * scale;      // меньше шрифт

  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 z-50"
      style={{
        bottom: '40px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: `${H}px`,
        padding: `0 ${PX}px`,
        width: 'max-content',           // ширина по содержимому
        maxWidth: maxWidth ? `${maxWidth}px` : undefined, // но не шире блока имени
        whiteSpace: 'nowrap',           // не переносим
        overflow: 'hidden',             // на всякий
        textOverflow: 'ellipsis',       // троеточие, если не влезло
        borderRadius: `${R}px`,
        backgroundColor: config.color,
        boxShadow: '0px 3px 8px rgba(0, 0, 0, 0.35)',
        pointerEvents: 'none',          // чтобы не мешал кликам
      }}
    >
      <span
        className="text-white uppercase"
        style={{
          fontWeight: 800,
          fontSize: `${FS}px`,
          lineHeight: 1,
          letterSpacing: '0.03em',
        }}
      >
        {config.text}
      </span>
    </div>
  );
}