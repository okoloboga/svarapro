import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import '@/utils/i18n';

console.log('main.tsx - Prepare');
const root = createRoot(document.getElementById('root')!);
console.log('main.tsx - Rendering App');
root.render(<App />);
