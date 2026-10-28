// Objetos sueltos encima de la arena como obstáculos: el jugador y los enemigos de tierra los rodean y las balas
// desaparecen al darles. TS puro: lo usan el motor (choques) y el render (qué objeto pintar en cada casilla).
// DECISIÓN: como los charcos, cada casilla decide con un hash de la semilla si lleva objeto; el motor guarda los
// radios de las casillas de alrededor del jugador en una rejilla fija y la renueva al cambiar de casilla.
import { HAZARDS } from '../config/radiation';
import { PROP_LIST, PROP_RADII, PROPS } from '../config/props';
import { RUN } from '../config/run';
import { cellRand, hazardAt } from './hazards';
import type { World } from './types';

const T = RUN.groundCell;
const R = HAZARDS.window;
const SIDE = 2 * R + 1;

/** Rejilla vacía para `World.obstacles`. */
export const createObstacleGrid = (): Float32Array => new Float32Array(SIDE * SIDE);

/** Índice (en `PROP_LIST`) del objeto de la casilla (i, j), o −1. Nunca en charcos ni junto a la salida. */
export function propAt(seed: number, i: number, j: number, startX: number, startY: number): number {
  if (PROP_LIST.length === 0 || cellRand(seed, i, j, 6) >= PROPS.chance) return -1;
  if (hazardAt(seed, i, j, startX, startY) >= 0) return -1;
  const dx = (i + 0.5) * T - startX;
  const dy = (j + 0.5) * T - startY;
  if (dx * dx + dy * dy < HAZARDS.safe * HAZARDS.safe) return -1;
  return Math.floor(cellRand(seed, i, j, 7) * PROP_LIST.length);
}

/** Renueva los radios de los obstáculos de alrededor del jugador si ha cambiado de casilla. */
export function refreshObstacles(w: World): void {
  if (!w.hazardsOn) return;
  const ci = Math.floor(w.player.x / T);
  const cj = Math.floor(w.player.y / T);
  const c = w.obstacleCell;
  if (ci === c.i && cj === c.j) return;
  c.i = ci;
  c.j = cj;
  for (let dj = 0; dj < SIDE; dj++)
    for (let di = 0; di < SIDE; di++) {
      const k = propAt(w.seed, ci - R + di, cj - R + dj, w.start.x, w.start.y);
      w.obstacles[dj * SIDE + di] = k >= 0 ? PROP_RADII[k]! : 0;
    }
}

/** Radio del obstáculo de la casilla (i, j); 0 si no hay o queda fuera de la ventana. */
function radiusAt(w: World, i: number, j: number): number {
  const di = i - w.obstacleCell.i + R;
  const dj = j - w.obstacleCell.j + R;
  if (di < 0 || dj < 0 || di >= SIDE || dj >= SIDE) return 0;
  return w.obstacles[dj * SIDE + di]!;
}

/**
 * Saca el círculo (o, r) de los obstáculos que pisa. Lo que el obstáculo le quita del avance (vx, vy) se convierte
 * en un paso de lado, hacia donde ya se desviaba o hacia `side` si va de frente, para que lo rodee.
 */
export function blockCircle(
  w: World,
  o: { x: number; y: number },
  r: number,
  vx: number,
  vy: number,
  side: number,
): void {
  if (!w.hazardsOn) return;
  const ci = Math.floor(o.x / T);
  const cj = Math.floor(o.y / T);
  for (let j = cj - 1; j <= cj + 1; j++)
    for (let i = ci - 1; i <= ci + 1; i++) {
      const ro = radiusAt(w, i, j);
      if (ro === 0) continue;
      let dx = o.x - (i + 0.5) * T;
      let dy = o.y - (j + 0.5) * T;
      let d = Math.sqrt(dx * dx + dy * dy);
      const min = r + ro;
      if (d >= min) continue;
      if (d < 1e-6) {
        dx = 1;
        dy = 0;
        d = 1;
      }
      const nx = dx / d;
      const ny = dy / d;
      const pen = min - d;
      o.x += nx * pen;
      o.y += ny * pen;
      if (vx * nx + vy * ny < 0) {
        const s = vy * nx - vx * ny;
        const sgn = Math.abs(s) > 1e-3 ? Math.sign(s) : side;
        o.x += -ny * sgn * pen;
        o.y += nx * sgn * pen;
      }
    }
}

/** ¿El punto (x, y) cae dentro de algún obstáculo? */
export function hitsObstacle(w: World, x: number, y: number): boolean {
  if (!w.hazardsOn) return false;
  const ci = Math.floor(x / T);
  const cj = Math.floor(y / T);
  for (let j = cj - 1; j <= cj + 1; j++)
    for (let i = ci - 1; i <= ci + 1; i++) {
      const ro = radiusAt(w, i, j);
      if (ro === 0) continue;
      const dx = x - (i + 0.5) * T;
      const dy = y - (j + 0.5) * T;
      if (dx * dx + dy * dy < ro * ro) return true;
    }
  return false;
}
