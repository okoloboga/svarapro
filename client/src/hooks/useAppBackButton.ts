import { backButton, isTMA } from '@telegram-apps/sdk-react';
import { useEffect } from 'react';

export const useAppBackButton = (isVisible: boolean, handler: () => void) => {
  useEffect(() => {
    if (!isTMA()) {
      console.warn('Not in Telegram environment. BackButton will not be used.');
      return;
    }

    if (!window.Telegram?.WebApp) {
      console.warn('Telegram WebApp is not available. BackButton will not be used.');
      return;
    }

    try {
      if (!backButton.isSupported()) {
        console.warn('BackButton is not supported in this environment');
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
        try {
          backButton.offClick(handler);
        } catch (e) {
          console.error('Error cleaning up BackButton handler:', e);
        }
      };
    } catch (e) {
      console.error('Error managing BackButton:', e);
    }
  }, [isVisible, handler]);
};
