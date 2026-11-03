// Pantalla completa desde el navegador. Instalada ya arranca así (manifest.webmanifest) y el botón sobra; en iPhone
// Safari no ofrece la API, así que no hay botón y Ajustes explica cómo añadir el juego a la pantalla de inicio.
import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';

const INSTALLED =
  window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const SUPPORTED = !INSTALLED && document.fullscreenEnabled === true;

/** Sin botón posible: toca instalar el juego para jugar sin las barras del navegador. */
export const NEEDS_INSTALL = !INSTALLED && !SUPPORTED;

function subscribe(onChange: () => void): () => void {
  document.addEventListener('fullscreenchange', onChange);
  return () => document.removeEventListener('fullscreenchange', onChange);
}

async function toggle(): Promise<void> {
  if (document.fullscreenElement) return document.exitFullscreen();
  await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
  // DECISIÓN: el juego es apaisado. Solo Android deja bloquear el giro; en el resto basta con ignorar el rechazo.
  const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
  await orientation.lock?.('landscape');
}

export function FullscreenButton() {
  const { t } = useTranslation();
  const active = useSyncExternalStore(subscribe, () => document.fullscreenElement !== null);
  if (!SUPPORTED) return null;
  return (
    <button className="term-btn" onClick={() => void toggle().catch(() => undefined)}>
      {t(active ? 'settings.fullscreenExit' : 'settings.fullscreen')}
    </button>
  );
}
