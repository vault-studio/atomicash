// Oleadas: tramo vigente, mezcla de tipos por pesos, topes y puntos de aparición fuera de cámara.
import { CAMPAIGN, type ActId } from '../../../config/acts';
import {
  ELITES,
  ENEMY_STATS,
  type EnemyRole,
  type EnemyStats,
  type StatEnemyId,
} from '../../../config/enemies';
import { ENTITIES } from '../../../config/entities';
import { tuningVersion } from '../../../config/tuning';
import { underCap } from '../../rules';
import { SPAWN, WAVES, type WaveDef } from '../../../config/waves';
import type { World } from '../../types';
import { offscreenDistance } from '../../view';
import { actTime } from '../campaign';

/** Índice en `WAVES` de la oleada vigente en el segundo `t` del acto (para depuración y HUD). */
export function currentWaveIndex(act: ActId, t: number): number {
  let idx = -1;
  for (let i = 0; i < WAVES.length; i++) {
    const x = WAVES[i]!;
    if (x.act === act && (idx < 0 || t >= x.from)) idx = i;
  }
  return Math.max(0, idx);
}

/** Oleada vigente en el segundo `t` del acto. */
export function currentWave(act: ActId, t: number): WaveDef {
  return WAVES[currentWaveIndex(act, t)]!;
}

// Pesos de cada oleada precalculados para no recorrer objetos en cada aparición; se rehacen si el depurador cambia
// los valores (`tuningVersion`).
let mix: { types: StatEnemyId[]; weights: number[] }[] = [];
let mixVersion = -1;
export function waveMix(i: number): { types: StatEnemyId[]; weights: number[] } {
  if (mixVersion !== tuningVersion()) {
    mixVersion = tuningVersion();
    mix = WAVES.map((wave) => {
      const types: StatEnemyId[] = [];
      const weights: number[] = [];
      for (const [id, wgt] of Object.entries(wave.mix) as [StatEnemyId, number][]) {
        if (wgt > 0) {
          types.push(id);
          weights.push(wgt);
        }
      }
      return { types, weights };
    });
  }
  return mix[i]!;
}

/** Vivos de un tipo (solo se cuenta para los que tienen tope) o, con `role`, de todos los tipos de ese rol. */
function aliveOf(w: World, type: StatEnemyId, role?: EnemyRole): number {
  let n = 0;
  for (let i = 0; i < w.enemies.count; i++) {
    const e = w.enemies.items[i]!;
    if (e.dead) continue;
    if (role === undefined ? e.type === type : (ENEMY_STATS[e.type] as EnemyStats).role === role) n++;
  }
  return n;
}

/** ¿Pertenece al acto y su rol ya se ha desbloqueado? */
export function unlocked(w: World, type: StatEnemyId): boolean {
  const role = (ENEMY_STATS[type] as EnemyStats).role;
  return ENTITIES[type].act === w.act && (role === undefined || actTime(w) >= CAMPAIGN.gates[role]);
}

/**
 * ¿Puede salir ahora? Enemigo del acto, con su rol ya desbloqueado (`CAMPAIGN.gates`), y bajo su tope en pantalla (`cap`;
 * con `capRole` cuenta los vivos de su mismo rol, sean del tipo que sean).
 */
export function spawnable(w: World, type: StatEnemyId): boolean {
  if (!unlocked(w, type)) return false;
  const s: EnemyStats = ENEMY_STATS[type];
  return underCap(s.cap ? aliveOf(w, type, s.capRole === true ? s.role : undefined) : 0, s.cap);
}

export const canElite = (w: World, t: StatEnemyId): boolean => spawnable(w, t) && !ELITES.exclude.includes(t);

/** Tipo al azar según los pesos de la oleada, entre los que cumplen `can`; null si ninguno. */
export function pickType(
  w: World,
  waveIdx: number,
  can: (w: World, t: StatEnemyId) => boolean = spawnable,
): StatEnemyId | null {
  const m = waveMix(waveIdx);
  let total = 0;
  for (let i = 0; i < m.types.length; i++) if (can(w, m.types[i]!)) total += m.weights[i]!;
  if (total <= 0) return null;
  let r = w.rng() * total;
  let last: StatEnemyId | null = null;
  for (let i = 0; i < m.types.length; i++) {
    const t = m.types[i]!;
    if (!can(w, t)) continue;
    last = t;
    r -= m.weights[i]!;
    if (r < 0) return t;
  }
  return last;
}

/** Elige un punto fuera de cámara alrededor del jugador y lo escribe en `out` (el mapa no tiene bordes). */
export function placeOffscreen(w: World, out: { x: number; y: number }): void {
  const p = w.player;
  const a = w.rng() * Math.PI * 2;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const base = offscreenDistance(w, ux, uy) + SPAWN.offscreenMargin;
  const d = (base > SPAWN.minDist ? base : SPAWN.minDist) + w.rng() * SPAWN.jitter;
  out.x = p.x + ux * d;
  out.y = p.y + uy * d;
}

export const spot = { x: 0, y: 0 };
export const TAU = Math.PI * 2;

/** Punto en un anillo de radio `d ± jitter` alrededor del jugador. */
export function ringPos(w: World, d: number, jitter: number): void {
  const p = w.player;
  const a = w.rng() * TAU;
  const dd = d + (w.rng() * 2 - 1) * jitter;
  spot.x = p.x + Math.cos(a) * dd;
  spot.y = p.y + Math.sin(a) * dd;
}
