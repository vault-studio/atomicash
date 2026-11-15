// Ruido, nubes de ceniza y luz de la pantalla de carga.
import { LX, LY, LZ, RP } from '../ExpeditionLoader';

export const sat = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const ease = (v: number): number => 1 - (1 - sat(v)) ** 3;
export const smooth = (e0: number, e1: number, v: number): number => {
  const t = sat((v - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const pad = (n: number): string => String(n).padStart(2, '0');

/** Hash entero de dos enteros → [0, 1). */
export function hash(x: number, y: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Ruido de valor suave en [0, 1]. */
export function noise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const u = x - xi;
  const v = y - yi;
  const su = u * u * (3 - 2 * u);
  const sv = v * v * (3 - 2 * v);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
}

/** Desplazamiento al centro de la bola de humo más cercana (lo deja `puff`). */
export let PX = 0;
export let PY = 0;

/** Worley: distancia a la bola de humo más cercana (centros repartidos sin amontonarse); deja su desplazamiento. */
export function puff(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let best = 9;
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const cx = xi + i;
      const cy = yi + j;
      const dx = cx + 0.15 + 0.7 * hash(cx, cy) - x;
      const dy = cy + 0.15 + 0.7 * hash(cy + 71, cx + 13) - y;
      const d = dx * dx + dy * dy;
      if (d < best) {
        best = d;
        PX = dx;
        PY = dy;
      }
    }
  return Math.sqrt(best);
}

/** Luz sobre la bola de humo a distancia `d` de su centro (desplazamiento al centro dx, dy): una esfera mate. */
export function lambert(d: number, dx: number, dy: number): number {
  if (d >= RP) return 0;
  const nz = Math.sqrt(RP * RP - d * d) / RP;
  return Math.max(0, (-dx / RP) * LX + (-dy / RP) * LY + nz * LZ);
}
