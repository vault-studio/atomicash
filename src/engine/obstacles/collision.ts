// Colisión de círculos y cuerpos con los obstáculos. Sin decimales como argumento: van en `body`.
import { decimalFields } from '../pool';
import type { World } from '../types';
import { T, slot } from './grid';

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** Entrada de `blockBody`. Va en un objeto: en el bucle de IA, cada decimal pasado como argumento reservaría memoria. */
export const body = decimalFields({ r: 0, vx: 0, vy: 0, side: 1 });

/** `blockBody` con el radio y el avance como argumentos, para quien no va en el bucle de la multitud. */
export function blockCircle(
  w: World,
  o: { x: number; y: number },
  r: number,
  vx: number,
  vy: number,
  side: number,
): void {
  body.r = r;
  body.vx = vx;
  body.vy = vy;
  body.side = side;
  blockBody(w, o);
}

/**
 * Saca el círculo (`o`, `body.r`) de los obstáculos que pisa. Lo que el obstáculo le quita del avance (`body.vx`,
 * `body.vy`) se convierte en un paso de lado, hacia donde ya se desviaba o hacia `body.side` si va de frente, para que
 * lo rodee. Un objeto de varias casillas está en todas ellas: tras el primer empujón ya no hay solape y los demás no
 * hacen nada.
 */
export function blockBody(w: World, o: { x: number; y: number }): void {
  if (!w.hazardsOn) return;
  const r = body.r;
  const vx = body.vx;
  const vy = body.vy;
  const side = body.side;
  const g = w.obstacles;
  const ci = Math.floor(o.x / T);
  const cj = Math.floor(o.y / T);
  for (let j = cj - 1; j <= cj + 1; j++)
    for (let i = ci - 1; i <= ci + 1; i++) {
      const s = slot(w, i, j);
      if (s < 0) continue;
      const cx = g[s]!;
      const cy = g[s + 1]!;
      const hx = g[s + 2]!;
      const hy = g[s + 3]!;
      const min = r + g[s + 4]!;
      const dx = o.x - clamp(o.x, cx - hx, cx + hx);
      const dy = o.y - clamp(o.y, cy - hy, cy + hy);
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d >= min) continue;
      let nx: number;
      let ny: number;
      let pen: number;
      if (d > 1e-6) {
        nx = dx / d;
        ny = dy / d;
        pen = min - d;
      } else {
        // Dentro del núcleo: sale por el lado más cercano.
        const px = hx - Math.abs(o.x - cx);
        const py = hy - Math.abs(o.y - cy);
        if (px < py) {
          nx = o.x >= cx ? 1 : -1;
          ny = 0;
          pen = px + min;
        } else {
          nx = 0;
          ny = o.y >= cy ? 1 : -1;
          pen = py + min;
        }
      }
      o.x += nx * pen;
      o.y += ny * pen;
      if (vx * nx + vy * ny < 0) {
        const t = vy * nx - vx * ny;
        const sgn = Math.abs(t) > 1e-3 ? Math.sign(t) : side;
        o.x += -ny * sgn * pen;
        o.y += nx * sgn * pen;
      }
    }
}

/** ¿El punto (x, y) cae dentro de algún obstáculo? */
export function hitsObstacle(w: World, x: number, y: number): boolean {
  if (!w.hazardsOn) return false;
  const g = w.obstacles;
  const ci = Math.floor(x / T);
  const cj = Math.floor(y / T);
  for (let j = cj - 1; j <= cj + 1; j++)
    for (let i = ci - 1; i <= ci + 1; i++) {
      const s = slot(w, i, j);
      if (s < 0) continue;
      const dx = x - clamp(x, g[s]! - g[s + 2]!, g[s]! + g[s + 2]!);
      const dy = y - clamp(y, g[s + 1]! - g[s + 3]!, g[s + 1]! + g[s + 3]!);
      const r = g[s + 4]!;
      if (dx * dx + dy * dy < r * r) return true;
    }
  return false;
}
