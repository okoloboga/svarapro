interface ActionNotificationProps {
  action?: 'blind' | 'paid' | 'pass' | 'rais' | 'win' | null;
  visible: boolean;
}

// Final configuration for styles and text.
const actionConfig = {
  blind: { text: 'ВСЛЕПУЮ', color: '#0E5C89' },
  paid: { text: 'ОПЛАТИЛ', color: '#0E5C89' },
  pass: { text: 'ПАС', color: '#FF3131' },
  rais: { text: 'ПОВЫСИЛ', color: '#56BF00' },
  win: { text: 'ВЫИГРАЛ', color: '#56BF00' },
};

export function ActionNotification({ action, visible }: ActionNotificationProps) {
  if (!action || !visible) {
    return null;
  }

  const config = actionConfig[action];

  return (
    <div 
      className="absolute bottom-0 left-1/2 transform -translate-x-1/2 z-50 flex items-center justify-center"
      style={{ 
        width: '62px',
        height: '18px',
        borderRadius: '4px',
        backgroundColor: config.color,
        bottom: '38px', 
      }}
    >
      <span className="text-white text-[10px] font-extrabold leading-none text-center">{config.text}</span>
    </div>
  );
}
