// Rejilla de obstáculos alrededor del jugador: qué objeto hay en cada casilla (determinista por semilla).
import type { ActId } from '../../config/acts';
import { HAZARDS } from '../../config/radiation';
import { PROP_BUILDING, PROP_SHAPES, PROPS, PROPS_BY_ACT } from '../../config/props';
import { RUN } from '../../config/run';
import { buildingBlock, cellKey, cellRand, hazardAt, nearBuilding } from '../hazards';
import type { Building, World } from '../types';

export const T = RUN.groundCell;
const R = HAZARDS.window;
const SIDE = 2 * R + 1;
/** Por casilla de la rejilla: centro de la huella (x, y), semilados del núcleo (hx, hy) y radio (0 = libre). */
const STRIDE = 5;

/** Rejilla vacía para `World.obstacles`. */
export const createObstacleGrid = (): Float32Array => new Float32Array(SIDE * SIDE * STRIDE);

/** Lo que hay en una casilla: el objeto, su casilla de arriba a la izquierda y el centro de su huella. */
export interface CellObject {
  prop: number;
  i: number;
  j: number;
  x: number;
  y: number;
}

export const createCellObject = (): CellObject => ({ prop: -1, i: 0, j: 0, x: 0, y: 0 });

function free(seed: number, i: number, j: number, sx: number, sy: number): boolean {
  if (hazardAt(seed, i, j, sx, sy) >= 0) return false;
  const dx = (i + 0.5) * T - sx;
  const dy = (j + 0.5) * T - sy;
  return dx * dx + dy * dy >= HAZARDS.safe * HAZARDS.safe;
}

const pick = (list: readonly number[], r: number): number => list[Math.floor(r * list.length)]!;
const B = PROPS.block;

/** ¿Están libres las casillas [i0, i0 + n) × [j0, j0 + m)? */
function allFree(
  seed: number,
  i0: number,
  j0: number,
  n: number,
  m: number,
  sx: number,
  sy: number,
): boolean {
  for (let j = j0; j < j0 + m; j++)
    for (let i = i0; i < i0 + n; i++) if (!free(seed, i, j, sx, sy)) return false;
  return true;
}

/**
 * Rellena `out` con el objeto que ocupa la casilla (i, j); false si no hay ninguno. El acto solo cambia qué objeto
 * sale, no dónde.
 */
export function objectAt(
  seed: number,
  i: number,
  j: number,
  sx: number,
  sy: number,
  out: CellObject,
  act: ActId = 1,
): boolean {
  const props = PROPS_BY_ACT[act];
  const bi = Math.floor(i / B);
  const bj = Math.floor(j / B);
  const i0 = bi * B;
  const j0 = bj * B;
  const r = cellRand(seed, bi, bj, 8);
  const big = PROPS.chance9 * B * B;
  if (buildingBlock(seed, bi, bj, sx, sy)) {
    out.prop = pick(props[9], cellRand(seed, bi, bj, 9));
    out.i = i0;
    out.j = j0;
    out.x = (i0 + B / 2) * T;
    out.y = (j0 + B / 2) * T;
    return true;
  }
  if (r >= big && r < big + PROPS.chance2 * B * B && props[2].length > 0) {
    const row = j0 + Math.floor(cellRand(seed, bi, bj, 10) * B);
    const col = i0 + Math.floor(cellRand(seed, bi, bj, 12) * (B - 1));
    if (
      j === row &&
      i >= col &&
      i < col + 2 &&
      allFree(seed, col, row, 2, 1, sx, sy) &&
      !nearBuilding(seed, col, row, sx, sy) &&
      !nearBuilding(seed, col + 1, row, sx, sy)
    ) {
      out.prop = pick(props[2], cellRand(seed, bi, bj, 11));
      out.i = col;
      out.j = row;
      out.x = (col + 1) * T;
      out.y = (row + 0.5) * T;
      return true;
    }
  }
  if (props[1].length === 0 || cellRand(seed, i, j, 6) >= PROPS.chance1) return false;
  if (!free(seed, i, j, sx, sy) || nearBuilding(seed, i, j, sx, sy)) return false;
  out.prop = pick(props[1], cellRand(seed, i, j, 7));
  out.i = i;
  out.j = j;
  out.x = (i + 0.5) * T;
  out.y = (j + 0.5) * T;
  return true;
}

/** Como `objectAt`, contando los escombros que han dejado el mortero y la lluvia de chatarra. */
export function worldObjectAt(w: World, i: number, j: number, out: CellObject): boolean {
  if (objectAt(w.seed, i, j, w.start.x, w.start.y, out, w.act)) return true;
  const s = w.scars.get(cellKey(i, j));
  if (s?.kind !== 'rubble') return false;
  out.prop = s.v;
  out.i = i;
  out.j = j;
  out.x = s.x;
  out.y = s.y;
  return true;
}

export const cell = createCellObject();

/** Renueva las formas de choque y los edificios de alrededor del jugador si ha cambiado de casilla. */
export function refreshObstacles(w: World): void {
  if (!w.hazardsOn) return;
  const ci = Math.floor(w.player.x / T);
  const cj = Math.floor(w.player.y / T);
  const c = w.obstacleCell;
  if (ci === c.i && cj === c.j) return;
  c.i = ci;
  c.j = cj;
  const buildings: Building[] = [];
  const g = w.obstacles;
  for (let dj = 0; dj < SIDE; dj++)
    for (let di = 0; di < SIDE; di++) {
      const i = ci - R + di;
      const j = cj - R + dj;
      const o = (dj * SIDE + di) * STRIDE;
      if (!worldObjectAt(w, i, j, cell)) {
        g[o + 4] = 0;
        continue;
      }
      const s = PROP_SHAPES[cell.prop]!;
      g[o] = cell.x;
      g[o + 1] = cell.y;
      g[o + 2] = s.hx;
      g[o + 3] = s.hy;
      g[o + 4] = s.r;
      const kind = PROP_BUILDING[cell.prop];
      if (kind && i === cell.i && j === cell.j)
        buildings.push({ x: cell.x, y: cell.y, kind, key: `${cell.i},${cell.j}` });
    }
  w.buildings = buildings;
}

/**
 * Apunta en la rejilla un objeto nuevo de la casilla (i, j). DECISIÓN: sin recalcular la ventana entera, que reserva
 * memoria y los morteros disparan a menudo; fuera de la ventana lo recoge `refreshObstacles`.
 */
export function putObstacle(w: World, i: number, j: number, prop: number, x: number, y: number): void {
  const di = i - w.obstacleCell.i + R;
  const dj = j - w.obstacleCell.j + R;
  if (!(di >= 0 && dj >= 0 && di < SIDE && dj < SIDE)) return;
  const s = PROP_SHAPES[prop]!;
  const o = (dj * SIDE + di) * STRIDE;
  const g = w.obstacles;
  g[o] = x;
  g[o + 1] = y;
  g[o + 2] = s.hx;
  g[o + 3] = s.hy;
  g[o + 4] = s.r;
}

/** Desplazamiento en la rejilla de la casilla (i, j); −1 si está libre o fuera de la ventana. */
export function slot(w: World, i: number, j: number): number {
  const di = i - w.obstacleCell.i + R;
  const dj = j - w.obstacleCell.j + R;
  if (di < 0 || dj < 0 || di >= SIDE || dj >= SIDE) return -1;
  const o = (dj * SIDE + di) * STRIDE;
  return w.obstacles[o + 4]! > 0 ? o : -1;
}
