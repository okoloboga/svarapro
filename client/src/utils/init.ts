import { init, backButton, expandViewport, swipeBehavior, isTMA } from '@telegram-apps/sdk-react';

let isInitialized = false;

export async function initTelegramSdk(): Promise<void> {
  if (isInitialized) {
    console.log('Telegram SDK already initialized');
    return;
  }

  if (!isTMA()) {
    console.warn('Not running in Telegram Mini App environment. Skipping SDK initialization.');
    return;
  }

  try {
    console.log('Starting Telegram SDK initialization');
    await init(); // init теперь асинхронный
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
    throw e; // Пробрасываем ошибку, чтобы App.tsx мог обработать её
  }
}
