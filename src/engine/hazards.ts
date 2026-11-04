// Charcos radiactivos de un mapa sin bordes. TS puro: lo usan el motor (daño) y el render (lago pintado).
// DECISIÓN: como el mapa no se acaba, no se generan de antemano: cada casilla del suelo decide con un hash de la
// semilla si lleva charco y de qué tamaño. El motor guarda solo los de alrededor del jugador y los renueva al
// cambiar de casilla.
import { PROPS, PROPS_BY_CELLS } from '../config/props';
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

/** Charco de la casilla tal como sale del hash, antes de apartarlo de los edificios. */
function rawHazard(seed: number, i: number, j: number, startX: number, startY: number): number {
  if (cellRand(seed, i, j, 1) >= HAZARDS.density) return -1;
  const dx = (i + 0.5) * T - startX;
  const dy = (j + 0.5) * T - startY;
  if (dx * dx + dy * dy < HAZARDS.safe * HAZARDS.safe) return -1;
  return Math.floor(cellRand(seed, i, j, 2) * HAZARDS.cellRadii.length);
}

const B = PROPS.block;
const BIG = PROPS.chance9 * B * B;

/** ¿La casilla está lejos de la salida y sin ácido? (Sin contar el hueco que abren los edificios.) */
function buildable(seed: number, i: number, j: number, sx: number, sy: number): boolean {
  if (rawHazard(seed, i, j, sx, sy) >= 0) return false;
  const dx = (i + 0.5) * T - sx;
  const dy = (j + 0.5) * T - sy;
  return dx * dx + dy * dy >= HAZARDS.safe * HAZARDS.safe;
}

/** ¿El bloque quiere edificio y cabe? */
function buildingCandidate(seed: number, bi: number, bj: number, sx: number, sy: number): boolean {
  if (cellRand(seed, bi, bj, 8) >= BIG || PROPS_BY_CELLS[9].length === 0) return false;
  for (let j = bj * B; j < (bj + 1) * B; j++)
    for (let i = bi * B; i < (bi + 1) * B; i++) if (!buildable(seed, i, j, sx, sy)) return false;
  return true;
}

/**
 * ¿Hay edificio en el bloque? Entre candidatos a menos de `PROPS.buildingGap` bloques gana el de hash menor, así dos
 * edificios nunca salen juntos y cada bloque se decide sin mirar el resto del mapa.
 */
export function buildingBlock(seed: number, bi: number, bj: number, sx: number, sy: number): boolean {
  if (!buildingCandidate(seed, bi, bj, sx, sy)) return false;
  const G = PROPS.buildingGap;
  const r = cellRand(seed, bi, bj, 8);
  for (let dj = -G; dj <= G; dj++)
    for (let di = -G; di <= G; di++) {
      if (di === 0 && dj === 0) continue;
      if (cellRand(seed, bi + di, bj + dj, 8) >= r) continue;
      if (buildingCandidate(seed, bi + di, bj + dj, sx, sy)) return false;
    }
  return true;
}

/** ¿La casilla es de un edificio o de la franja libre (`PROPS.clearance` casillas) que lo rodea? */
export function nearBuilding(seed: number, i: number, j: number, sx: number, sy: number): boolean {
  const c = PROPS.clearance;
  const b0 = Math.floor((i - c) / B);
  const b1 = Math.floor((i + c) / B);
  const d0 = Math.floor((j - c) / B);
  const d1 = Math.floor((j + c) / B);
  for (let bj = d0; bj <= d1; bj++)
    for (let bi = b0; bi <= b1; bi++) if (buildingBlock(seed, bi, bj, sx, sy)) return true;
  return false;
}

/** Índice del radio (en `HAZARDS.cellRadii`) del charco de la casilla (i, j), o −1 si no tiene. */
export function hazardAt(seed: number, i: number, j: number, startX: number, startY: number): number {
  const k = rawHazard(seed, i, j, startX, startY);
  return k >= 0 && !nearBuilding(seed, i, j, startX, startY) ? k : -1;
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
