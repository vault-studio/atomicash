// Fase 4 del dossier: barriles explosivos, objetivos en el mapa (§11) y modo infinito tras el Coloso (§17).
import { CAMPAIGN } from '../../config/acts';
import { BARRELS, DAILY, ENDLESS, OBJECTIVES } from '../../config/modes';
import { JUICE } from '../../config/run';
import { addShake, banner, boom, burst, hitStop } from '../fx';
import { hurtIndex } from '../runStats';
import { SFX, sfx } from '../sfx';
import type { Barrel, World } from '../types';
import { offscreenDistance } from '../view';
import { areaClutter } from '../obstacles';
import { HIT_RAW, addChest, addCoupons, hitEnemy, hurtPlayer, queryEnemies } from './combat';

const TAU = Math.PI * 2;
const BARREL_SPARKS = [0xff5a3c, 0xffaa3c, 0xffe14a, 0x6c7178] as const;

export const createBarrel = (): Barrel => ({ x: 0, y: 0, r: 0, fuse: -1 });

// ---------- barriles ----------

const barrelMax = (w: World): number =>
  Math.round(BARRELS.max * (w.dailyMod === 'barrels' ? DAILY.barrels.max : 1));

/** Revienta el barril `i`: daño en área a enemigos (y al jugador si está cerca) y prende los barriles vecinos. */
export function explodeBarrel(w: World, i: number): void {
  const b = w.barrels.items[i]!;
  const x = b.x;
  const y = b.y;
  w.barrels.releaseAt(i);
  const R = BARRELS.blastR * w.st.area;
  const dmg = BARRELS.dmg * (1 + w.time * BARRELS.dmgPerSec) * w.st.dmgMult;
  const out = w.qBlast;
  const k = queryEnemies(w, x, y, R, out);
  for (let j = 0; j < k; j++) hitEnemy(w, w.enemies.items[out[j]!]!, dmg, 'barril', HIT_RAW, 2, x, y);
  const p = w.player;
  const dx = p.x - x;
  const dy = p.y - y;
  if (dx * dx + dy * dy < (R * 0.7) ** 2) hurtPlayer(w, BARRELS.playerDmg, 0, false, hurtIndex('barril'));
  // Los vecinos se encienden con un instante de retraso: la cadena se ve.
  for (let j = 0; j < w.barrels.count; j++) {
    const o = w.barrels.items[j]!;
    if (o.fuse < 0 && (o.x - x) ** 2 + (o.y - y) ** 2 < R * R) o.fuse = 0.12;
  }
  boom(w, x, y, R, 0.4, 0xff7a2a);
  burst(w, x, y, 18, BARREL_SPARKS, 1.6);
  addShake(w, 7, 14);
  hitStop(w, JUICE.hitStop.grenade);
}

/** ¿Algo del jugador toca el barril? Disparos, explosiones y charcos de fuego. */
function barrelTouched(w: World, b: Barrel): boolean {
  for (let i = 0; i < w.shots.count; i++) {
    const s = w.shots.items[i]!;
    const rr = b.r + s.r;
    if ((s.x - b.x) ** 2 + (s.y - b.y) ** 2 < rr * rr) {
      s.life = 0;
      return true;
    }
  }
  for (let i = 0; i < w.booms.count; i++) {
    const o = w.booms.items[i]!;
    // Solo explosiones recién nacidas (no las que se están apagando).
    if (o.life < o.max - 0.05) continue;
    const rr = b.r + o.r;
    if ((o.x - b.x) ** 2 + (o.y - b.y) ** 2 < rr * rr) return true;
  }
  for (let i = 0; i < w.pools.count; i++) {
    const o = w.pools.items[i]!;
    const rr = b.r + o.r;
    if ((o.x - b.x) ** 2 + (o.y - b.y) ** 2 < rr * rr) return true;
  }
  return false;
}

export function updateBarrels(w: World, dt: number): void {
  const p = w.player;
  const D2 = BARRELS.despawn * BARRELS.despawn;
  for (let i = w.barrels.count - 1; i >= 0; i--) {
    const b = w.barrels.items[i]!;
    if ((b.x - p.x) ** 2 + (b.y - p.y) ** 2 > D2) {
      w.barrels.releaseAt(i);
      continue;
    }
    if (b.fuse >= 0) {
      b.fuse -= dt;
      if (b.fuse <= 0) explodeBarrel(w, i);
    } else if (barrelTouched(w, b)) explodeBarrel(w, i);
  }
  // Sin objetos en el mapa (pruebas), no se ponen barriles nuevos.
  w.barrelT -= dt;
  if (!w.hazardsOn || w.barrelT > 0 || w.barrels.count >= barrelMax(w)) return;
  w.barrelT = BARRELS.every;
  // Un grupo justo fuera de cámara, en una dirección al azar.
  const a = w.rng() * TAU;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const d = offscreenDistance(w, ux, uy) + 80 + w.rng() * 200;
  const cx = p.x + ux * d;
  const cy = p.y + uy * d;
  const n = BARRELS.groupMin + Math.floor(w.rng() * (BARRELS.groupMax - BARRELS.groupMin + 1));
  for (let k = 0; k < n && w.barrels.count < barrelMax(w); k++) {
    const b = w.barrels.acquire();
    b.x = cx + (w.rng() - 0.5) * BARRELS.groupSpread * 2;
    b.y = cy + (w.rng() - 0.5) * BARRELS.groupSpread * 2;
    b.r = BARRELS.r;
    b.fuse = -1;
  }
}

// ---------- objetivos ----------

export function startObjective(w: World): void {
  const kind = OBJECTIVES.order[w.objectiveIdx++ % OBJECTIVES.order.length]!;
  const p = w.player;
  const def = OBJECTIVES[kind];
  // La zona busca un sitio sin edificios, ácido ni objetos: prueba direcciones y distancias y se queda con el mejor.
  const a0 = w.rng() * TAU;
  let x = p.x;
  let y = p.y;
  let best = Infinity;
  for (let k = 0; k < OBJECTIVES.tries && best > 0; k++) {
    const t = a0 + (k * TAU) / OBJECTIVES.spokes;
    const d = OBJECTIVES.dist * (1 + OBJECTIVES.distStep * Math.floor(k / OBJECTIVES.spokes));
    const cx = p.x + Math.cos(t) * d;
    const cy = p.y + Math.sin(t) * d;
    const c = areaClutter(w, cx, cy, OBJECTIVES.r + OBJECTIVES.margin);
    if (c < best) {
      best = c;
      x = cx;
      y = cy;
    }
  }
  w.objective = {
    kind,
    x,
    y,
    r: OBJECTIVES.r,
    progress: 0,
    goal: def.goal,
    left: def.limit,
  };
  sfx(w, SFX.boss);
  banner(w, `banner.objective.${kind}`);
}

/** Una baja con el jugador dentro de la zona de un objetivo de purga (el enemigo puede estar fuera). */
export function objectiveKill(w: World): void {
  const o = w.objective;
  if (!o || o.kind !== 'purge') return;
  const p = w.player;
  if ((p.x - o.x) ** 2 + (p.y - o.y) ** 2 < o.r * o.r) o.progress++;
}

export function updateObjective(w: World, dt: number): void {
  const o = w.objective;
  if (!o) {
    if (w.bossAlive > 0 && w.nextObjective < w.time + 10) w.nextObjective = w.time + 10;
    if (w.time >= w.nextObjective) {
      startObjective(w);
      w.nextObjective = w.time + OBJECTIVES.everyMin + w.rng() * (OBJECTIVES.everyMax - OBJECTIVES.everyMin);
    }
    return;
  }
  const p = w.player;
  if (o.kind === 'hold' && (p.x - o.x) ** 2 + (p.y - o.y) ** 2 < o.r * o.r) o.progress += dt;
  o.left -= dt;
  if (o.progress >= o.goal) {
    w.objective = null;
    w.objectivesDone++;
    addChest(w, 'cache', o.x, o.y, 18);
    addCoupons(w, OBJECTIVES.coupons);
    sfx(w, SFX.boss);
    banner(w, 'banner.objectiveDone');
  } else if (o.left <= 0) {
    w.objective = null;
    banner(w, 'banner.objectiveFail');
  }
}

// ---------- modo infinito ----------

/** Cae el Coloso: se gana la run y se pregunta si seguir en infinito. */
export function colossusDown(w: World): void {
  w.won = true;
  w.winTime = w.time;
  if (w.endless) return;
  w.choice = { type: 'endless', cards: [] };
}

/** Respuesta a la pregunta del modo infinito. */
export function chooseEndless(w: World, go: boolean): void {
  if (w.choice?.type !== 'endless') return;
  w.choice = null;
  if (!go) {
    w.over = true;
    return;
  }
  w.endless = true;
  w.endlessAt = w.time;
  // Los élites y los eventos especiales empiezan a salir a su ritmo de infinito desde ya.
  w.nextElite = Math.min(w.nextElite, w.time + ENDLESS.eliteEvery);
  w.nextSpecial = w.time + CAMPAIGN.specials.endlessEvery;
  banner(w, 'banner.endless');
}

/** Minutos de infinito jugados (0 si no). */
export const endlessMin = (w: World): number => (w.endless ? (w.time - w.endlessAt) / 60 : 0);
