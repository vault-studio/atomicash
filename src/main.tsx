import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './app/styles.css';
import './app/run.css';
import { validateConfig } from './config/validate';
import './i18n';

if (import.meta.env.DEV) {
  const errors = validateConfig();
  if (errors.length) console.error('[config] errores de validación:\n' + errors.join('\n'));
}

const root = document.getElementById('root');
if (!root) throw new Error('Falta #root en index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
