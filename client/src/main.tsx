import { createRoot } from 'react-dom/client';
import { mockTelegram } from './mocks/telegram';
import App from './App';
import './index.css';
import './utils/i18n';

async function prepare() {
  console.log('main.tsx - Prepare');
  // Активируем mockTelegram для локального тестирования, независимо от DEV
  if (process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost') {
    console.log('main.tsx - Before mockTelegram');
    await mockTelegram();
    console.log('main.tsx - After mockTelegram');
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

prepare().then(() => {
  console.log('main.tsx - Rendering App');
  const root = createRoot(document.getElementById('root')!);
  root.render(<App />);
});
