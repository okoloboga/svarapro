import { createRoot } from 'react-dom/client';

import './index.css';
import '@/utils/i18n';
import App from './App';

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
