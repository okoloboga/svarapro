import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import '@/utils/i18n';

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
