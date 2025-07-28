import { useEffect } from 'react';
import './PopSuccess.css';
import completeIcon from '../../assets/complete.png';

type PopSuccessProps = {
  message?: string;
  onClose: () => void;
};

export function PopSuccess({ message = "Успешно скопировано!", onClose }: PopSuccessProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);

    return () => {
      clearTimeout(timer);
    };
  }, [onClose]);

  return (
    <div className="pop-success">
      <img src={completeIcon} alt="Success" className="pop-success-icon" />
      <span>{message}</span>
    </div>
  );
}
