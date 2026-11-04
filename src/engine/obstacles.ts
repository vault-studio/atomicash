// Objetos sueltos encima de la arena como obstáculos: el jugador y los enemigos de tierra los rodean y las balas
// desaparecen al darles. TS puro: lo usan el motor (choques, edificios) y el render (qué objeto pintar y dónde).
// DECISIÓN: como los charcos, el mapa no se genera de antemano: cada bloque de 3×3 casillas decide con un hash de
// la semilla si lleva un edificio (las 9), un objeto de 2 casillas (en una de sus filas) o, si no, objetos de una
// casilla sueltos. Nunca sobre ácido ni junto a la salida, y alrededor de un edificio no hay nada más. El motor guarda
// la forma de choque de las casillas de alrededor del jugador en una rejilla fija y la renueva al cambiar de casilla.
import { HAZARDS } from '../config/radiation';
import { BUILDINGS, PROP_BUILDING, PROP_SHAPES, PROPS, PROPS_BY_CELLS } from '../config/props';
import { RUN } from '../config/run';
import { buildingBlock, cellRand, hazardAt, nearBuilding } from './hazards';
import type { Building, World } from './types';

const T = RUN.groundCell;
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

/** Rellena `out` con el objeto que ocupa la casilla (i, j); false si no hay ninguno. */
export function objectAt(
  seed: number,
  i: number,
  j: number,
  sx: number,
  sy: number,
  out: CellObject,
): boolean {
  const bi = Math.floor(i / B);
  const bj = Math.floor(j / B);
  const i0 = bi * B;
  const j0 = bj * B;
  const r = cellRand(seed, bi, bj, 8);
  const big = PROPS.chance9 * B * B;
  if (buildingBlock(seed, bi, bj, sx, sy)) {
    out.prop = pick(PROPS_BY_CELLS[9], cellRand(seed, bi, bj, 9));
    out.i = i0;
    out.j = j0;
    out.x = (i0 + B / 2) * T;
    out.y = (j0 + B / 2) * T;
    return true;
  }
  if (r >= big && r < big + PROPS.chance2 * B * B && PROPS_BY_CELLS[2].length > 0) {
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
      out.prop = pick(PROPS_BY_CELLS[2], cellRand(seed, bi, bj, 11));
      out.i = col;
      out.j = row;
      out.x = (col + 1) * T;
      out.y = (row + 0.5) * T;
      return true;
    }
  }
  if (PROPS_BY_CELLS[1].length === 0 || cellRand(seed, i, j, 6) >= PROPS.chance1) return false;
  if (!free(seed, i, j, sx, sy) || nearBuilding(seed, i, j, sx, sy)) return false;
  out.prop = pick(PROPS_BY_CELLS[1], cellRand(seed, i, j, 7));
  out.i = i;
  out.j = j;
  out.x = (i + 0.5) * T;
  out.y = (j + 0.5) * T;
  return true;
}

const cell = createCellObject();

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
      if (!objectAt(w.seed, i, j, w.start.x, w.start.y, cell)) {
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

/** Desplazamiento en la rejilla de la casilla (i, j); −1 si está libre o fuera de la ventana. */
function slot(w: World, i: number, j: number): number {
  const di = i - w.obstacleCell.i + R;
  const dj = j - w.obstacleCell.j + R;
  if (di < 0 || dj < 0 || di >= SIDE || dj >= SIDE) return -1;
  const o = (dj * SIDE + di) * STRIDE;
  return w.obstacles[o + 4]! > 0 ? o : -1;
}

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/**
 * Saca el círculo (o, r) de los obstáculos que pisa. Lo que el obstáculo le quita del avance (vx, vy) se convierte
 * en un paso de lado, hacia donde ya se desviaba o hacia `side` si va de frente, para que lo rodee.
 * Un objeto de varias casillas está en todas ellas: tras el primer empujón ya no hay solape y los demás no hacen nada.
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

const probe = createCellObject();
export const BUILDING_WEIGHT = 100;

/**
 * Cuánto estorba lo que hay en el cuadrado de semilado r alrededor de (x, y): 0 si está despejado; cada casilla con ácido
 * u objeto suma 1 y un edificio, `BUILDING_WEIGHT`. Para colocar las zonas de objetivo.
 */
export function areaClutter(w: World, x: number, y: number, r: number): number {
  const i1 = Math.floor((x + r) / T);
  const j1 = Math.floor((y + r) / T);
  let n = 0;
  for (let j = Math.floor((y - r) / T); j <= j1; j++)
    for (let i = Math.floor((x - r) / T); i <= i1; i++) {
      if (hazardAt(w.seed, i, j, w.start.x, w.start.y) >= 0) n++;
      else if (objectAt(w.seed, i, j, w.start.x, w.start.y, probe))
        n += PROP_BUILDING[probe.prop] ? BUILDING_WEIGHT : 1;
    }
  return n;
}

/**
 * Sitio de un cofre: si (x, y) cae dentro de un edificio o detrás de él en pantalla, pasa a su esquina delantera o a
 * la derecha, las dos que se ven siempre; y si cae sobre un objeto, se adelanta hasta salir de él. Escribe en `out`.
 */
export function chestSpot(w: World, x: number, y: number, out: { x: number; y: number }): void {
  const C = BUILDINGS.chest;
  out.x = x;
  out.y = y;
  for (const b of w.buildings) {
    const u = x - b.x - (y - b.y);
    const v = x - b.x + (y - b.y);
    if (Math.abs(u) >= C.hideU || v <= -C.hideBack || v + Math.abs(u) >= C.hideFront) continue;
    out.x = b.x + BUILDINGS.cache.offset;
    out.y = b.y + (u > 0 ? -BUILDINGS.cache.offset : BUILDINGS.cache.offset);
    return;
  }
  for (let k = 0; k < C.nudges && hitsObstacle(w, out.x, out.y); k++) {
    out.x += C.nudge;
    out.y += C.nudge;
  }
}
