import { createRoot } from 'react-dom/client';

import './index.css';
import '@/utils/i18n';
import AppTest from './AppTest';

const root = createRoot(document.getElementById('root')!);
root.render(<AppTest />);
