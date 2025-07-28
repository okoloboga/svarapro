import { init, backButton, expandViewport, swipeBehavior } from '@telegram-apps/sdk-react';

let isInitialized = false;

export function initTelegramSdk(): void {
  if (isInitialized) {
    console.log('Telegram SDK already initialized');
    return;
  }

  try {
    init();
    expandViewport();
    
    // Монтируем кнопку "Назад", если она поддерживается
    if (backButton.isSupported()) {
      backButton.mount();
      console.log('BackButton mounted');
    } else {
      console.warn('BackButton is not supported in this environment');
    }

    // Монтируем и настраиваем swipeBehavior
    swipeBehavior.mount();
    swipeBehavior.disableVertical();

    isInitialized = true;
    console.log('Telegram SDK initialized successfully');
  } catch (e) {
    console.error('Telegram SDK init error:', e);
  }
}
