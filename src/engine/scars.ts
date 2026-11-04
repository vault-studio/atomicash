// Destrozos del mapa: lo que dejan el mortero y las lluvias al caer. TS puro: lo usan el motor y el render.
// DECISIÓN: el mapa sale de un hash y no cambia, así que los destrozos van aparte, en `w.scars` (una entrada por casilla
// y se quedan toda la partida). `worldHazardAt` y `worldObjectAt` los suman a lo que dice el hash.
// Como en cada casilla cabe un destrozo y cada escombro queda a `RAINS.rubbleInset` del borde de la suya, entre dos
// escombros siempre pasa el jugador: por mucho que caiga, nunca queda encerrado.
import { AI } from '../config/enemies';
import { RAINS } from '../config/modes';
import { PROP_SHAPES, RUBBLE_PROPS } from '../config/props';
import { HAZARDS } from '../config/radiation';
import { RUN } from '../config/run';
import { cellKey, cellRand, nearBuilding, worldHazardAt } from './hazards';
import { createCellObject, putObstacle, worldObjectAt } from './obstacles';
import { burst } from './fx';
import { SFX, sfx } from './sfx';
import type { TeleFall, World } from './types';

const T = RUN.groundCell;
const RUBBLE_SPARKS = [0x8a7a68, 0x5a5048, 0xb0a08a, 0xd8a53a] as const;
const ACID_SPARKS = [0x9dff00, 0x7dff3a, 0xc8ff00] as const;
const probe = createCellObject();

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/**
 * ¿Puede caer un destrozo en la casilla? No sobre objetos, ácido u otro destrozo, ni junto a un edificio, ni en la zona
 * de un objetivo activo, ni donde hay un cofre que recoger.
 */
export function scarFree(w: World, i: number, j: number): boolean {
  if (!w.hazardsOn || w.scars.has(cellKey(i, j))) return false;
  if (worldHazardAt(w, i, j) >= 0 || worldObjectAt(w, i, j, probe)) return false;
  if (nearBuilding(w.seed, i, j, w.start.x, w.start.y)) return false;
  const o = w.objective;
  if (o) {
    const r = o.r + RAINS.objectiveMargin;
    if (((i + 0.5) * T - o.x) ** 2 + ((j + 0.5) * T - o.y) ** 2 < r * r) return false;
  }
  for (let k = 0; k < w.pickups.count; k++) {
    const c = w.pickups.items[k]!;
    if (c.kind !== 'chest' && c.kind !== 'crate' && c.kind !== 'cache') continue;
    if (Math.floor(c.x / T) === i && Math.floor(c.y / T) === j) return false;
  }
  return true;
}

/** Rompe el suelo en (x, y) y deja un montón de escombros que bloquea el paso y las balas. */
export function addRubble(w: World, x: number, y: number): boolean {
  const i = Math.floor(x / T);
  const j = Math.floor(y / T);
  if (!scarFree(w, i, j)) return false;
  const prop = RUBBLE_PROPS[Math.floor(cellRand(w.seed, i, j, 13) * RUBBLE_PROPS.length)]!;
  const inset = PROP_SHAPES[prop]!.r + RAINS.rubbleInset;
  const cx = clamp(x, i * T + inset, (i + 1) * T - inset);
  const cy = clamp(y, j * T + inset, (j + 1) * T - inset);
  w.scars.set(cellKey(i, j), { kind: 'rubble', v: prop, x: cx, y: cy });
  putObstacle(w, i, j, prop, cx, cy);
  return true;
}

/** Crea un lago de ácido en el centro de la casilla (i, j); `hz` es su radio en `HAZARDS.cellRadii`. */
export function addAcid(w: World, i: number, j: number, hz: number): boolean {
  if (!scarFree(w, i, j)) return false;
  const x = (i + 0.5) * T;
  const y = (j + 0.5) * T;
  w.scars.set(cellKey(i, j), { kind: 'acid', v: hz, x, y });
  // Fuera de la ventana lo recoge `refreshHazards` cuando el jugador se acerque.
  const R = HAZARDS.window;
  if (Math.abs(i - w.hazardCell.i) <= R && Math.abs(j - w.hazardCell.j) <= R)
    w.hazards.push({ x, y, r: T * HAZARDS.cellRadii[hz]! });
  return true;
}

const NEAR = [1, 0, 1, 1, 0, 1, -1, 1, -1, 0, -1, -1, 0, -1, 1, -1] as const;

/** El hinchado revienta: losetas de ácido juntas (`AI.hinchado.acidCells`), del lago grande, alrededor de (x, y). */
export function acidPatch(w: World, x: number, y: number): void {
  const i = Math.floor(x / T);
  const j = Math.floor(y / T);
  const big = HAZARDS.cellRadii.length - 1;
  let left = AI.hinchado.acidCells;
  if (addAcid(w, i, j, big)) left--;
  // Las vecinas, empezando por una al azar y saltando para que la mancha no salga siempre en fila.
  const from = Math.floor(w.rng() * 8);
  for (let k = 0; k < 8 && left > 0; k++) {
    const n = (from + k * 3) % 8;
    if (addAcid(w, i + NEAR[n * 2]!, j + NEAR[n * 2 + 1]!, big)) left--;
  }
}

/** Marca en el suelo algo que caerá en (x, y) dentro de `dur` s; `updateTelegraphs` lo resuelve con `landFall`. */
export function markFall(
  w: World,
  x: number,
  y: number,
  r: number,
  dur: number,
  dmg: number,
  rad: number,
  src: number,
  fall: TeleFall,
  hz = 0,
): void {
  const t = w.tele.acquire();
  t.x = x;
  t.y = y;
  t.r = r;
  t.lx = 0;
  t.ly = 0;
  t.t = 0;
  t.dur = dur;
  t.dmg = dmg;
  t.spawn = null;
  t.src = src;
  t.rad = rad;
  t.fall = fall;
  t.hz = hz;
}

/** Algo ha caído del cielo en (x, y): deja su destrozo si la casilla lo admite. */
export function landFall(w: World, fall: TeleFall, x: number, y: number, hz: number): void {
  if (fall === 'acid') {
    addAcid(w, Math.floor(x / T), Math.floor(y / T), hz);
    burst(w, x, y, 14, ACID_SPARKS, 1.3);
    sfx(w, SFX.pop);
    return;
  }
  addRubble(w, x, y);
  burst(w, x, y, 12, RUBBLE_SPARKS, 1.3);
  if (fall === 'scrap') sfx(w, SFX.slam);
}
