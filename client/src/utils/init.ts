import { init, expandViewport, swipeBehavior } from '@telegram-apps/sdk-react';

let isInitialized = false;

export function initTelegramSdk(): void {
  if (isInitialized) {
    return;
  }

  try {
    init();
    expandViewport();
    
    // Сначала "монтируем" компонент, чтобы с ним можно было работать
    swipeBehavior.mount(); 
    // А теперь отключаем вертикальный свайп
    swipeBehavior.disableVertical();
    
    isInitialized = true;
  } catch (e) {
    console.error('Telegram SDK init error:', e);
  }
}
