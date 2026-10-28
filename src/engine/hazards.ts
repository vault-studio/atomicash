// Charcos radiactivos de un mapa sin bordes. TS puro: lo usan el motor (daño) y el render (lago pintado).
// DECISIÓN: como el mapa no se acaba, no se generan de antemano: cada casilla del suelo decide con un hash de la
// semilla si lleva charco y de qué tamaño. El motor guarda solo los de alrededor del jugador y los renueva al
// cambiar de casilla.
import { HAZARDS } from '../config/radiation';
import { RUN } from '../config/run';
import type { Hazard, World } from './types';

const T = RUN.groundCell;

/** Hash entero de (semilla, i, j, sal) → [0, 1). */
export function cellRand(seed: number, i: number, j: number, salt = 0): number {
  let h =
    (seed ^ Math.imul(i, 0x27d4eb2d) ^ Math.imul(j, 0x165667b1) ^ Math.imul(salt + 1, 0x9e3779b9)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Índice del radio (en `HAZARDS.cellRadii`) del charco de la casilla (i, j), o −1 si no tiene. */
export function hazardAt(seed: number, i: number, j: number, startX: number, startY: number): number {
  if (cellRand(seed, i, j, 1) >= HAZARDS.density) return -1;
  const dx = (i + 0.5) * T - startX;
  const dy = (j + 0.5) * T - startY;
  if (dx * dx + dy * dy < HAZARDS.safe * HAZARDS.safe) return -1;
  return Math.floor(cellRand(seed, i, j, 2) * HAZARDS.cellRadii.length);
}

/** Renueva `w.hazards` con los charcos de alrededor del jugador si ha cambiado de casilla. */
export function refreshHazards(w: World): void {
  if (!w.hazardsOn) return;
  const ci = Math.floor(w.player.x / T);
  const cj = Math.floor(w.player.y / T);
  if (ci === w.hazardCell.i && cj === w.hazardCell.j) return;
  w.hazardCell.i = ci;
  w.hazardCell.j = cj;
  const out: Hazard[] = [];
  const R = HAZARDS.window;
  for (let j = cj - R; j <= cj + R; j++)
    for (let i = ci - R; i <= ci + R; i++) {
      const k = hazardAt(w.seed, i, j, w.start.x, w.start.y);
      if (k >= 0) out.push({ x: (i + 0.5) * T, y: (j + 0.5) * T, r: T * HAZARDS.cellRadii[k]! });
    }
  w.hazards = out;
}
