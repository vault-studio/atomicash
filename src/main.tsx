import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
// Tipografías OFL de 04_ART_UI.md §1, empaquetadas (local-first, sin CDN).
import '@fontsource/vt323/400.css';
import '@fontsource/bungee/400.css';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import './app/styles.css';
import './app/run.css';
import './app/bunker.css';
import { validateConfig } from './config/validate';
import { audio } from './audio/audio';
import './i18n';

if (import.meta.env.DEV) {
  const errors = validateConfig();
  if (errors.length) console.error('[config] errores de validación:\n' + errors.join('\n'));
}

// El AudioContext solo puede arrancar tras un gesto; se desbloquea con el primero y el menú pone su música.
const unlock = (): void => audio.unlock();
// pointerdown con el dedo no cuenta como gesto en móvil: hacen falta pointerup/touchend/click.
for (const ev of ['pointerup', 'touchend', 'click', 'keydown'])
  window.addEventListener(ev, unlock, { capture: true, passive: true });
audio.setMusic('menu');
// Silencio al perder el foco (04_ART_UI.md §4).
document.addEventListener('visibilitychange', () => audio.setFocused(!document.hidden));
window.addEventListener('blur', () => audio.setFocused(false));
window.addEventListener('focus', () => audio.setFocused(true));

// PWA (F3-09): el service worker solo existe en el build; precachea el juego para jugar sin conexión.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('sw.js'));
}

const root = document.getElementById('root');
if (!root) throw new Error('Falta #root en index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
