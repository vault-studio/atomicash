import { StrictMode, type ReactNode } from 'react';
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
import './app/intro.css';
import './app/nukeload.css';
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

const reactRoot = createRoot(root);
const mount = (screen: ReactNode): void => reactRoot.render(<StrictMode>{screen}</StrictMode>);

// Depurador (T2): con `?dev` la run arranca sin intro ni búnker y con el panel encima. La rama entera desaparece del
// build de producción (`import.meta.env.DEV` es false), así que ni el panel ni su CSS llegan al bundle.
if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('dev')) {
  void import('./app/debug/DevApp').then(({ DevApp }) => mount(<DevApp />));
} else {
  mount(<App />);
}
