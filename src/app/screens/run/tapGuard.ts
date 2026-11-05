// Pantallas que se abren al apretar (radar, botón de pausa): el clic de ese mismo toque llega después y caería sobre lo
// que haya aparecido bajo el dedo, que podría ser «Abandonar expedición».
import { useCallback, useEffect, useRef } from 'react';
import { TAP_GUARD_MS } from '../../../config/render';

/** Devuelve con qué envolver las acciones de la pantalla: ignora las que llegan nada más abrirse. */
export function useTapGuard(open: boolean): (action: () => void) => void {
  const openedAt = useRef(0);
  useEffect(() => {
    if (open) openedAt.current = performance.now();
  }, [open]);
  return useCallback((action) => {
    if (performance.now() - openedAt.current > TAP_GUARD_MS) action();
  }, []);
}
