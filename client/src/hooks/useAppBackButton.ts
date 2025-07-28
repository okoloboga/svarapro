import { backButton, isTMA } from '@telegram-apps/sdk-react';
import { useEffect } from 'react';

export const useAppBackButton = (isVisible: boolean, handler: () => void) => {
  useEffect(() => {
    if (!isTMA()) {
      console.warn('Not in Telegram environment. BackButton will not be used.');
      return;
    }

    if (!backButton.isMounted()) {
      console.warn('BackButton is not mounted. Ensure initTelegramSdk() is called and completed.');
      return;
    }

    if (isVisible) {
      console.log('BackButton: Showing');
      backButton.show();
      backButton.onClick(handler);
    } else {
      console.log('BackButton: Hiding');
      backButton.hide();
    }

    return () => {
      console.log('BackButton: Cleaning up handler');
      backButton.offClick(handler);
    };
  }, [isVisible, handler]);
};
