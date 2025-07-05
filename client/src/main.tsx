import { createRoot } from 'react-dom/client';
import { mockTelegram } from './mocks/telegram';
import App from './App';
import './index.css';
import './utils/i18n';
import { retrieveLaunchParams } from '@telegram-apps/sdk-react';

async function prepare() {
  console.log('main.tsx - Prepare');
  // Активируем мок, если USE_MOCK=true или локальный хост
  const useMock = import.meta.env.USE_MOCK === 'true' || window.location.hostname === 'localhost';
  if (useMock) {
    console.log('main.tsx - Before mockTelegram');
    await mockTelegram();
    console.log('main.tsx - After mockTelegram, checking launch params:', retrieveLaunchParams());
    await new Promise((resolve) => setTimeout(resolve, 200));
  } else {
    console.log('main.tsx - Running without mock');
  }
}

prepare().then(() => {
  console.log('main.tsx - Rendering App');
  const root = createRoot(document.getElementById('root')!);
  root.render(<App />);
});
