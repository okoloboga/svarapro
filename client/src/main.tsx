import { createRoot } from 'react-dom/client';
import { mockTelegram } from './mocks/telegram';
import App from './App';
import './index.css';
import './utils/i18n';

async function prepare() {
  if (import.meta.env.DEV) {
    await mockTelegram(); // Применяем моки ДО рендера
  }
}

prepare().then(() => {
  const root = createRoot(document.getElementById('root')!);
  root.render(<App />);
});
