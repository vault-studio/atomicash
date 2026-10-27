// Utilidades isométricas del render. La proyección (isoX, isoY) vive en engine/view.ts porque el motor
// la necesita para saber qué ve la cámara. Sin dependencias de Pixi para poder testearlo.
import { isoX, isoY } from '../engine/view';

export { isoX, isoY };

const ISO = Math.SQRT1_2;

/** Dirección de pantalla (teclas/joystick, y hacia abajo) → dirección de mundo, conservando la magnitud (≤ 1). */
export function screenToWorldDir(mx: number, my: number): { x: number; y: number } {
  const m = Math.min(1, Math.hypot(mx, my));
  if (m < 0.001) return { x: 0, y: 0 };
  const x = (mx + 2 * my) / (2 * ISO);
  const y = (2 * my - mx) / (2 * ISO);
  const l = Math.hypot(x, y);
  return { x: (x / l) * m, y: (y / l) * m };
}

/**
 * Dirección de mundo → fila del sprite en el orden S, SW, W, NW, N, NE, E, SE.
 * 8 sectores de 45° medidos en pantalla (biblia de arte §11.3).
 */
export function dirIndex(fx: number, fy: number): number {
  const sx = fx - fy;
  const sy = (fx + fy) * 0.5;
  if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9) return 0;
  const a = Math.atan2(sy, sx);
  return (((Math.round((a - Math.PI / 2) / (Math.PI / 4)) % 8) + 8) % 8) as number;
}
