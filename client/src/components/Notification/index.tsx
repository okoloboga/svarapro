import completeIcon from '../../assets/complete.png';
import errorIcon from '../../assets/error.png';
import cupIcon from '../../assets/cup.png';

type NotificationType = 'invalidAddress' | 'addressAlreadyUsed' | 'addressAdded' | 'comingSoon';

type NotificationProps = {
  type: NotificationType | null;
  onClose: () => void;
};

const notificationContent = {
  invalidAddress: {
    icon: errorIcon,
    text: 'Неверный адрес USDT-TON',
  },
  addressAlreadyUsed: {
    icon: errorIcon,
    text: 'Этот адрес уже используется в другой учетной записи',
  },
  addressAdded: {
    icon: completeIcon,
    text: 'Ваш USDT-TON адрес успешно добавлен',
  },
  comingSoon: {
    icon: cupIcon,
    text: 'Скоро...',
  },
};

export function Notification({ type, onClose }: NotificationProps) {
  if (!type) {
    return null;
  }

  const { icon, text } = notificationContent[type];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#47444C] w-[277px] h-[155px] rounded-lg flex flex-col items-center py-4 px-4 relative">
        <div className="flex flex-col items-center text-center mt-2">
          <img src={icon} alt={type} className="w-8 h-8 mb-4" />
          <p className="text-white font-semibold text-sm">{text}</p>
        </div>
        <div className="absolute bottom-[41px] left-1/2 -translate-x-1/2 w-[270px] h-px bg-white opacity-50" />
        <button onClick={onClose} className="absolute bottom-4 text-white font-semibold text-[17px]">
          ОК
        </button>
      </div>
    </div>
  );
}
