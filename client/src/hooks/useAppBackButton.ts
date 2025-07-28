import { backButton, useWebApp } from '@telegram-apps/sdk-react';
import { useEffect } from 'react';

export const useAppBackButton = (isVisible: boolean, handler: () => void) => {
  const webApp = useWebApp();

  useEffect(() => {
    if (webApp.initData) {
      if (isVisible) {
        backButton.show();
        backButton.onClick(handler);
      } else {
        backButton.hide();
      }
    }

    return () => {
      if (webApp.initData) {
        backButton.offClick(handler);
      }
    };
  }, [isVisible, handler, webApp.initData]);
};
