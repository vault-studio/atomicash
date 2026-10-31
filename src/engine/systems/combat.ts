// Daño a enemigos y al jugador, bajas, chatarra (XP) y radiación. Sin allocations en el camino caliente.
import {
  AI,
  ELITES,
  ENEMY_STATS,
  GORE,
  GORE_IRR,
  MAX_ENEMY_RADIUS,
  type EnemyStats,
} from '../../config/enemies';
import { BOSS_VARIANTS } from '../../config/enemies';
import { DROPS, FIELD_PICKUP_IDS, FIELD_PICKUPS, type FieldPickupId } from '../../config/items';
import { IRRADIATED, RAD, radTier } from '../../config/radiation';
import { BUILDINGS } from '../../config/props';
import { COUPONS, FX, JUICE, KNOCKBACK, PLAYER, STREAK, SUMMARY, XP, streakMult } from '../../config/run';
import { EVENTS } from '../../config/waves';
import { DAILY } from '../../config/modes';
import { SOURCE_INDEX, WEAPONS, type DamageSource } from '../../config/weapons';
import type { EntityId } from '../../config/entities';
import { addShake, banner, boom, burst, hitStop, textFx } from '../fx';
import { timeDmgMult } from '../stats';
import { SFX, sfx } from '../sfx';
import type { Enemy, Pickup, PickupKind, World } from '../types';
import { spawnEnemy } from './enemies';
import { colossusDown, objectiveKill } from './modes';

/** Opciones de `hitEnemy` como bits para no crear objetos en cada golpe. */
export const HIT_DIRECT = 1;
export const HIT_MELEE = 2;
/** Daño ya final: no se aplican multiplicadores del jugador. */
export const HIT_RAW = 4;
/** (fx, fy) es una dirección de empuje, no el origen del golpe. */
export const HIT_KB_DIR = 8;

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export const createPickup = (): Pickup => ({ kind: 'gem', val: 0, x: 0, y: 0, r: 0, pull: false, sp: 0 });

export function addPickup(
  w: World,
  kind: PickupKind,
  x: number,
  y: number,
  r: number,
  val = 0,
  pull = false,
): Pickup {
  const k = w.pickups.acquire();
  k.kind = kind;
  k.val = val;
  k.x = x;
  k.y = y;
  k.r = r;
  k.pull = pull;
  k.sp = 0;
  if (kind === 'gem') w.gemCount++;
  return k;
}

/** Suma cupones de la partida con el extra del árbol. Devuelve los sumados. */
export function addCoupons(w: World, n: number): number {
  const v = Math.round(n * (1 + (w.mods.coupons ?? 0) / 100));
  w.coupons += v;
  return v;
}

export function heal(w: World, amount: number): void {
  const p = w.player;
  p.hp = Math.min(p.maxHp, p.hp + amount);
}

export function addRad(w: World, amount: number): void {
  if (amount <= 0) return;
  const p = w.player;
  p.rad = clamp(p.rad + amount * w.st.radGain, 0, RAD.max);
  if (p.rad > p.radPeak) p.radPeak = p.rad;
}

export function irradiatedChance(w: World): number {
  return (
    IRRADIATED.base +
    w.time * IRRADIATED.perSec +
    radTier(w.player.rad).irr +
    (w.dailyMod === 'irradiated' ? DAILY.irradiated.chance : 0)
  );
}

/** Sprite que corresponde a un enemigo según su fase (variantes de la biblia de arte). */
export function spriteIdFor(e: Enemy): EntityId {
  const vs = BOSS_VARIANTS[e.type];
  if (!vs) return e.type;
  let id: EntityId = e.type;
  for (const v of vs) {
    if (v.below !== undefined && e.hp / e.maxHp < v.below) id = v.id;
    if (v.phase !== undefined && e.phase >= v.phase) id = v.id;
  }
  return id;
}

/** Enemigo vivo más cercano a (x, y) dentro de `maxR`; null si no hay. `ground`: ignora voladores. */
export function nearest(w: World, x: number, y: number, maxR: number, ground = false): Enemy | null {
  let best: Enemy | null = null;
  let bd = maxR * maxR;
  const items = w.enemies.items;
  for (let i = 0, n = w.enemies.count; i < n; i++) {
    const e = items[i]!;
    if (e.dead || (ground && e.flying)) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    const d = dx * dx + dy * dy;
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

/**
 * Hace daño a un enemigo. Devuelve el daño hecho.
 * `fx, fy`: origen del golpe para el empuje (o su dirección con HIT_KB_DIR).
 */
export function hitEnemy(
  w: World,
  e: Enemy,
  base: number,
  src: DamageSource,
  flags: number,
  kb = 0,
  fx = 0,
  fy = 0,
): number {
  if (e.dead) return 0;
  const st = w.st;
  let d = flags & HIT_RAW ? base : base * st.dmgMult * (flags & HIT_MELEE ? st.meleeMult : 1);
  if (e.boss) d *= st.bossMult;
  d *= (ENEMY_STATS[e.type] as EnemyStats).armor ?? 1;
  if (w.dailyMod === 'glass' && !(flags & HIT_RAW)) d *= DAILY.glass.dealt;
  // Único «Cazador» del árbol: más daño a jefes y élites.
  if ((e.boss || e.elite) && w.mods.hunter) d *= 1 + w.mods.hunter / 100;
  if (e.elite) {
    if (e.elite === 'blindado') d *= ELITES.blindado.dmgTaken;
    w.eliteFocus = e.id;
    w.eliteFocusAt = w.time;
  }
  let crit = false;
  if (flags & HIT_DIRECT && st.crit > 0 && w.rng() < st.crit) {
    d *= st.critMult;
    crit = true;
  }
  // Sin contar el exceso del último golpe: el ranking no puede superar la vida real del jefe.
  if (e.boss) w.bossDmg += Math.min(d, Math.max(0, e.hp));
  e.hp -= d;
  e.flash = 0.08;
  sfx(w, (ENEMY_STATS[e.type] as EnemyStats).metal ? SFX.hitMetal : SFX.hit, e.x, e.y);
  w.dmgTotal += d;
  if (d > w.maxHit) w.maxHit = d;
  const tb = Math.floor(w.time / SUMMARY.bucket);
  while (w.timeDmg.length <= tb) w.timeDmg.push(0);
  w.timeDmg[tb] = w.timeDmg[tb]! + d;
  if (flags & HIT_DIRECT) burst(w, e.x, e.y, JUICE.parts.perHit, e.irr ? GORE_IRR : GORE[e.type], 0.6);
  const si = SOURCE_INDEX[src];
  if (si !== undefined) w.dmgBy[si] = w.dmgBy[si]! + d;
  const b = Math.floor(w.time * 4);
  if (b !== w.dpsBucket) {
    // Limpia las cubetas saltadas del anillo.
    for (let k = w.dpsBucket + 1; k <= b && k - w.dpsBucket <= 16; k++) w.dpsB[k & 15] = 0;
    w.dpsBucket = b;
  }
  w.dpsB[b & 15] = w.dpsB[b & 15]! + d;
  if (kb > 0 && !e.boss) {
    let dx: number;
    let dy: number;
    if (flags & HIT_KB_DIR) {
      dx = fx;
      dy = fy;
    } else {
      dx = e.x - fx;
      dy = e.y - fy;
    }
    const l = Math.sqrt(dx * dx + dy * dy) || 1;
    const s: EnemyStats = ENEMY_STATS[e.type];
    const k = KNOCKBACK.base * kb * st.kb * (s.kbRes ?? 1) * (e.elite ? ELITES.kb : 1);
    e.kbx += (dx / l) * k;
    e.kby += (dy / l) * k;
  }
  if (crit) textFx(w, 'crit', e.x, e.y, Math.round(d));
  else if (w.showDmg) textFx(w, 'dmg', e.x, e.y, Math.round(d));
  if (e.hp <= 0) killEnemy(w, e, src);
  return d;
}

/** Consulta de enemigos que tocan el círculo (x, y, r), en el buffer `out`. */
export function queryEnemies(w: World, x: number, y: number, r: number, out: Int32Array): number {
  return w.enemyGrid.query(x, y, r, MAX_ENEMY_RADIUS, out);
}

/** Explosiones de hinchados pendientes; pueden encadenarse. */
export function resolveBlasts(w: World): void {
  const A = AI.hinchado;
  const out = w.qBlast;
  const p = w.player;
  while (w.blasts.count > 0) {
    const b = w.blasts.items[--w.blasts.count]!;
    const x = b.x;
    const y = b.y;
    boom(w, x, y, A.boomR, 0.3, FX.colors.bloater);
    const k = queryEnemies(w, x, y, A.boomR, out);
    for (let j = 0; j < k; j++) hitEnemy(w, w.enemies.items[out[j]!]!, A.boomEnemyDmg, 'hinchado', HIT_RAW);
    const dx = x - p.x;
    const dy = y - p.y;
    const rr = A.boomR + p.r;
    if (dx * dx + dy * dy < rr * rr) hurtPlayer(w, A.boomPlayerDmg, A.boomRad);
  }
}

/** Suelta chatarra por valor `value`, en las piezas más grandes posibles. */
export function dropGems(w: World, x: number, y: number, value: number): void {
  let v = Math.round(value);
  for (const g of XP.gems) {
    while (v >= g) {
      v -= g;
      if (w.gemCount >= XP.maxGems && mergeIntoGem(w, g)) continue;
      addPickup(w, 'gem', x + (w.rng() - 0.5) * 18, y + (w.rng() - 0.5) * 18, XP.gemRadius[g] ?? 3.5, g);
    }
  }
}

/** Reparte `value` de experiencia en `count` bolitas (el resto entero, en las primeras). */
export function dropKillGems(w: World, x: number, y: number, value: number, count: number): void {
  const v = Math.max(count, Math.round(value));
  const each = Math.floor(v / count);
  for (let i = 0; i < count; i++) {
    const g = each + (i < v % count ? 1 : 0);
    if (w.gemCount >= XP.maxGems && mergeIntoGem(w, g)) continue;
    const spread = count > 1 ? 18 : 0;
    addPickup(w, 'gem', x + (w.rng() - 0.5) * spread, y + (w.rng() - 0.5) * spread, gemRadius(g), g);
  }
}

/** Tamaño de la bolita según lo que vale. */
function gemRadius(v: number): number {
  for (const g of XP.gems) if (v >= g) return XP.gemRadius[g] ?? 3.5;
  return XP.gemRadius[1] ?? 3.5;
}

/** Con demasiadas gemas en el suelo, suma el valor a una existente al azar. */
function mergeIntoGem(w: World, g: number): boolean {
  const n = w.pickups.count;
  if (n === 0) return false;
  const start = (w.rng() * n) | 0;
  for (let j = 0; j < n; j++) {
    const k = w.pickups.items[(start + j) % n]!;
    if (k.kind === 'gem') {
      k.val += g;
      return true;
    }
  }
  return false;
}

function addCorpse(w: World, e: Enemy): void {
  let c;
  if (w.corpses.count < FX.maxCorpses) c = w.corpses.acquire();
  else {
    // Lleno: reutiliza el más antiguo.
    let oi = 0;
    for (let i = 1; i < w.corpses.count; i++) if (w.corpses.items[i]!.t < w.corpses.items[oi]!.t) oi = i;
    c = w.corpses.items[oi]!;
  }
  c.sprite = spriteIdFor(e);
  c.x = e.x;
  c.y = e.y;
  c.facingX = e.facingX;
  c.facingY = e.facingY;
  c.t = w.time;
  c.flying = e.flying;
  c.irr = e.irr;
}

/** Bajas por segundo en un anillo de `SUMMARY.window` s (para «más bajas en 5 s») y por tramo de la gráfica. */
function countKill(w: World): void {
  const sec = Math.floor(w.time);
  const W = SUMMARY.window;
  if (sec !== w.killSec) {
    for (let s = w.killSec + 1; s <= sec && s - w.killSec <= W; s++) w.killRing[s % W] = 0;
    w.killSec = sec;
  }
  w.killRing[sec % W] = w.killRing[sec % W]! + 1;
  let sum = 0;
  for (let i = 0; i < W; i++) sum += w.killRing[i]!;
  if (sum > w.peakKills5) w.peakKills5 = sum;
  const tb = Math.floor(w.time / SUMMARY.bucket);
  while (w.timeKills.length <= tb) w.timeKills.push(0);
  w.timeKills[tb] = w.timeKills[tb]! + 1;
}

export function killEnemy(w: World, e: Enemy, src: DamageSource): void {
  if (e.dead) return;
  e.dead = true;
  w.kills++;
  countKill(w);
  objectiveKill(w);
  const before = streakMult(w.streak);
  w.streak++;
  if (w.streak > w.bestStreak) w.bestStreak = w.streak;
  const mult = streakMult(w.streak);
  if (mult !== before) {
    banner(w, 'banner.streak', { n: String(w.streak), mult: String(mult) });
    sfx(w, SFX.pickup);
  }
  sfx(w, (ENEMY_STATS[e.type] as EnemyStats).metal ? SFX.killMetal : SFX.kill, e.x, e.y);
  addCorpse(w, e);
  const gore = e.irr ? GORE_IRR : GORE[e.type];
  if (e.boss) {
    burst(w, e.x, e.y, JUICE.parts.perBossKill, gore, 2);
    hitStop(w, JUICE.hitStop.boss);
    addShake(w, 14, 20);
  } else burst(w, e.x, e.y, JUICE.parts.perKill, gore, e.irr ? 1.4 : 1);
  const xp = e.xp * XP.killMult * (e.irr ? IRRADIATED.xp : 1) * (w.rain > 0 ? EVENTS.rain.xpMult : 1) * mult;
  if (xp > 0) {
    if (e.boss) dropGems(w, e.x, e.y, xp);
    else dropKillGems(w, e.x, e.y, xp, e.irr ? XP.rareGems : XP.killGems);
  }
  if (e.elite) {
    // Power-up siempre y, a veces, también el cofre especial (a un lado para que no se recojan juntos).
    addPickup(w, rollFieldPickup(w.rng()), e.x, e.y, FIELD_PICKUPS.r);
    if (w.rng() < ELITES.cacheChance) addPickup(w, 'cache', e.x + 40, e.y + 40, BUILDINGS.cache.r);
    banner(w, 'banner.eliteDown');
    hitStop(w, JUICE.hitStop.bomb);
    addShake(w, 6);
    if (e.elite === 'divisor') {
      const D = ELITES.divisor;
      for (let i = 0; i < D.split; i++) {
        const a = (i / D.split) * Math.PI * 2;
        spawnEnemy(w, e.type, e.x + Math.cos(a) * D.splitDist, e.y + Math.sin(a) * D.splitDist, false);
      }
    }
  } else if (e.gar >= 0) {
    const g = w.garrisons[e.gar]!;
    if (--g.left === 0) {
      addPickup(w, 'cache', g.x, g.y, BUILDINGS.cache.r);
      banner(w, 'banner.cache');
    }
  } else if (!e.boss && w.rng() < COUPONS.dropChance) {
    addPickup(w, 'coupon', e.x, e.y, COUPONS.r, COUPONS.drop);
  }
  if (e.boss) {
    w.bosses++;
    w.bossAlive--;
    if (e.type === 'rey_rata' || e.type === 'dirigible') {
      addPickup(w, 'chest', e.x, e.y, 14);
      banner(w, 'banner.chest');
    }
    if (e.type === 'dirigible') dropGems(w, e.x, e.y, AI.dirigible.dropXp);
    // El Coloso gana la run (y pregunta si seguir en infinito); en infinito solo es un jefe más.
    if (e.type === 'coloso' && !w.endless) colossusDown(w);
  }
  if (e.type === 'hinchado' && w.blasts.count < w.blasts.items.length) {
    // Se resuelve después (resolveBlasts): puede morir dentro de un bucle que ya recorre una consulta.
    const b = w.blasts.acquire();
    b.x = e.x;
    b.y = e.y;
  }
  if (e.type === 'aspiradora') {
    const A = AI.aspiradora;
    for (let i = 0; i < A.children; i++) {
      const a = (i / A.children) * Math.PI * 2;
      const c = spawnEnemy(
        w,
        A.childType,
        e.x + Math.cos(a) * A.childDist,
        e.y + Math.sin(a) * A.childDist,
        false,
      );
      c.facingX = e.facingX;
      c.facingY = e.facingY;
    }
  }
  if (src === 'jeringa' || src === 'dardos_incendiarios') {
    let lvl = 0;
    for (const wp of w.weapons) if (wp.id === src) lvl = wp.lvl;
    if (lvl > 0) {
      const W = WEAPONS.jeringa;
      const want = src === 'jeringa' ? W.healBase + W.healPerLvl * lvl : WEAPONS.dardos_incendiarios.healBase;
      const a = Math.min(want, w.player.healBudget);
      w.player.healBudget -= a;
      heal(w, a);
    }
  }
  if (w.rng() < DROPS.stimChance * (1 + w.st.luck / 50)) addPickup(w, 'stim', e.x, e.y, 7);
  else if (w.rng() < FIELD_PICKUPS.chance * (1 + w.st.luck / 50))
    addPickup(w, rollFieldPickup(w.rng()), e.x, e.y, FIELD_PICKUPS.r);
}

/** Elige botiquín, imán o bomba según sus pesos; `u` ∈ [0, 1). */
export function rollFieldPickup(u: number): FieldPickupId {
  const W = FIELD_PICKUPS.weights;
  let total = 0;
  for (const id of FIELD_PICKUP_IDS) total += W[id];
  let r = u * total;
  for (const id of FIELD_PICKUP_IDS) {
    if (r < W[id]) return id;
    r -= W[id];
  }
  return FIELD_PICKUP_IDS[FIELD_PICKUP_IDS.length - 1]!;
}

/** Daño al jugador. Devuelve el daño hecho, −1 si lo esquivó y 0 si era invulnerable. */
export function hurtPlayer(w: World, raw: number, rad = 0, noScale = false): number {
  const p = w.player;
  const st = w.st;
  if (p.inv > 0 || p.god || p.deadAt !== null) return 0;
  if (st.dodge > 0 && w.rng() < st.dodge) {
    p.inv = 0.2;
    sfx(w, SFX.dodge);
    textFx(w, 'dodge', p.x, p.y, 0);
    return -1;
  }
  const tm = noScale ? 1 : timeDmgMult(w.time);
  const d =
    Math.max(1, raw * tm - st.armor) * (1 - st.red) * (w.dailyMod === 'glass' ? DAILY.glass.taken : 1);
  p.hp -= d;
  p.inv = PLAYER.invuln;
  // Un golpe recibido corta la racha (si ya multiplicaba, se avisa).
  if (w.streak >= STREAK.tiers[STREAK.tiers.length - 1]!.at) banner(w, 'banner.streakLost');
  // Único «Sangre fría»: conserva parte de la racha.
  w.streak = Math.floor((w.streak * (w.mods.coldBlood ?? 0)) / 100);

  p.lastHit = w.time;
  sfx(w, SFX.hurt);
  w.shake = Math.min(FX.shakeMax, w.shake + 3);
  hitStop(w, JUICE.hitStop.hurt);
  if (rad > 0) addRad(w, rad);
  textFx(w, 'hurt', p.x, p.y, Math.round(d));
  return d;
}
