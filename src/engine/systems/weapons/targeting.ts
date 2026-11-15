// Elección de blancos: al azar, el más duro, la zona más poblada y los N más cercanos (buffers sin reservar).
import { type Enemy, type World } from '../../types';
import { queryEnemies } from '../combat';

/** Enemigo al azar (de suelo) dentro de `range`, por muestreo de embalse. */
export function randomInRange(w: World, range: number): Enemy | null {
  const p = w.player;
  const R2 = range * range;
  let pick: Enemy | null = null;
  let seenN = 0;
  for (let i = 0, n = w.enemies.count; i < n; i++) {
    const e = w.enemies.items[i]!;
    if (e.dead || e.flying) continue;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    if (dx * dx + dy * dy >= R2) continue;
    seenN++;
    if (w.rng() * seenN < 1) pick = e;
  }
  return pick;
}

/** El enemigo con más PV dentro de `range` (el rifle apunta al más duro). */
export function toughestInRange(w: World, range: number): Enemy | null {
  const p = w.player;
  const R2 = range * range;
  let best: Enemy | null = null;
  for (let i = 0, n = w.enemies.count; i < n; i++) {
    const e = w.enemies.items[i]!;
    if (e.dead) continue;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    if (dx * dx + dy * dy >= R2) continue;
    if (!best || e.hp > best.hp) best = e;
  }
  return best;
}

/**
 * El centro del grupo más denso a `range`: compara `samples` enemigos de tierra al azar por cuántos tienen a `crowdR`.
 * DECISIÓN: muestrear en vez de recorrer todos los pares, que con cientos de enemigos sería cuadrático.
 */
export function densestInRange(w: World, range: number, samples: number, crowdR: number): Enemy | null {
  let best: Enemy | null = null;
  let bestN = -1;
  for (let s = 0; s < samples; s++) {
    const e = randomInRange(w, range);
    if (!e) return best;
    const k = queryEnemies(w, e.x, e.y, crowdR, w.qWeapon);
    if (k > bestN) {
      best = e;
      bestN = k;
    }
  }
  return best;
}

export const nearIdx = new Int32Array(16);
const nearD = new Float64Array(16);

/** Los `n` enemigos más cercanos dentro de `range` (índices en `nearIdx`). Devuelve cuántos. */
export function nearestN(w: World, range: number, n: number): number {
  const p = w.player;
  const R2 = range * range;
  const cap = Math.min(n, nearIdx.length);
  let k = 0;
  for (let i = 0, c = w.enemies.count; i < c; i++) {
    const e = w.enemies.items[i]!;
    if (e.dead) continue;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = dx * dx + dy * dy;
    if (d >= R2) continue;
    if (k < cap) k++;
    else if (d >= nearD[k - 1]!) continue;
    // Inserción ordenada.
    let j = k - 1;
    while (j > 0 && nearD[j - 1]! > d) {
      nearD[j] = nearD[j - 1]!;
      nearIdx[j] = nearIdx[j - 1]!;
      j--;
    }
    nearD[j] = d;
    nearIdx[j] = i;
  }
  return k;
}
