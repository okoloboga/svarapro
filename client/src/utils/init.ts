import { init, backButton, expandViewport, swipeBehavior, isTMA } from '@telegram-apps/sdk-react';

let isInitialized = false;

export async function initTelegramSdk(): Promise<void> {
  if (isInitialized) {
    console.log('Telegram SDK already initialized');
    return;
  }

  // Проверяем наличие Telegram WebApp
  if (!window.Telegram?.WebApp) {
    console.error('Telegram WebApp is not available. Ensure the app is running in Telegram.');
    throw new Error('Telegram WebApp is not available');
  }

  if (!isTMA()) {
    console.warn('Not running in Telegram Mini App environment (isTMA returned false). Skipping SDK initialization.');
    throw new Error('Not in Telegram Mini App environment');
  }

  try {
    console.log('Starting Telegram SDK initialization');
    console.log('Telegram.WebApp version:', window.Telegram.WebApp.version);
    await init();
    console.log('SDK init() called successfully');

    await expandViewport();
    console.log('Viewport expanded');

    if (backButton.isSupported()) {
      await backButton.mount();
      console.log('BackButton mounted');
    } else {
      console.warn('BackButton is not supported in this environment');
    }

    await swipeBehavior.mount();
    swipeBehavior.disableVertical();
    console.log('Swipe behavior configured');

    isInitialized = true;
    console.log('Telegram SDK initialized successfully');
  } catch (e) {
    console.error('Telegram SDK init error:', e);
    isInitialized = false;
    throw e;
  }
}
