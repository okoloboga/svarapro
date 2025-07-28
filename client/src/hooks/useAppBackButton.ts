import { backButton } from '@telegram-apps/sdk-react';
import { useEffect } from 'react';

export const useAppBackButton = (handler: () => void) => {
  useEffect(() => {
    backButton.onClick(handler);

    return () => {
      backButton.offClick(handler);
    };
  }, [handler]);

  return {
    isVisible: backButton.isVisible,
    showButton: backButton.show.bind(backButton),
    hideButton: backButton.hide.bind(backButton),
  };
};
