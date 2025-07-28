import { backButton } from '@telegram-apps/sdk-react';
import { useEffect } from 'react';

export const useAppBackButton = (isVisible: boolean, handler: () => void) => {
  useEffect(() => {
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
