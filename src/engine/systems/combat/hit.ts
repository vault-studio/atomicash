// Golpes a enemigos (daño, crítico, blindaje, control), consultas por área y explosiones encadenadas.
import {
  ARMOR,
  AI,
  ELITES,
  ENEMY_STATS,
  GORE,
  GORE_IRR,
  MAX_ENEMY_RADIUS,
  type EnemyStats,
} from '../../../config/enemies';
import { BOSS_VARIANTS } from '../../../config/enemies';
import { acidPatch } from '../../scars';
import { FX, JUICE, KNOCKBACK, SUMMARY } from '../../../config/run';
import { DAILY } from '../../../config/modes';
import { FUSIONS, SOURCE_INDEX, WEAPONS, type DamageSource, type WeaponBase } from '../../../config/weapons';
import { TREE_FX } from '../../../config/tree';
import type { EntityId } from '../../../config/entities';
import { boom, burst, textFx } from '../../fx';
import { hurtIndex } from '../../runStats';
import { applyArmor } from '../../rules';
import { SFX, sfx } from '../../sfx';
import { MODE_DASH, type Enemy, type World } from '../../types';
import { interruptEnemy } from '../enemies';
import { killEnemy } from './kill';
import { heal, hurtPlayer } from './player';

/** Opciones de `hitEnemy` como bits para no crear objetos en cada golpe. */
export const HIT_DIRECT = 1;
export const HIT_MELEE = 2;
/** Daño ya final: no se aplican multiplicadores del jugador. */
export const HIT_RAW = 4;
/** (fx, fy) es una dirección de empuje, no el origen del golpe. */
export const HIT_KB_DIR = 8;

/** Armas que son resultado de una fusión (mod `fusionDmg`). */
const FUSED: ReadonlySet<string> = new Set(FUSIONS.map((f) => f.result));

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** Sprite que corresponde a un enemigo según su fase (variantes de la biblia de arte). */
export function spriteIdFor(e: Enemy): EntityId {
  if (e.skin !== null) return e.skin;
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
  if (e.hitAt < e.born) e.hitAt = w.time;
  const st = w.st;
  let d = flags & HIT_RAW ? base : base * st.dmgMult * (flags & HIT_MELEE ? st.meleeMult : 1);
  if (e.boss) d *= st.bossMult;
  // Motorista derrapando tras fallar la carga: recibe más daño.
  if (e.mode === MODE_DASH && e.type === 'motorista') d *= AI.motorista.exposedMult;
  if (src === w.starter) d *= st.starterMult;
  if (w.dailyMod === 'glass' && !(flags & HIT_RAW)) d *= DAILY.glass.dealt;
  // Único «Cazador» del árbol: más daño a jefes y élites.
  if ((e.boss || e.elite) && w.mods.hunter) d *= 1 + w.mods.hunter / 100;
  if (w.mods.fusionDmg && FUSED.has(src)) d *= 1 + w.mods.fusionDmg / 100;
  if (e.elite) {
    w.eliteFocus = e.id;
    w.eliteFocusAt = w.time;
  }
  let crit = false;
  if (flags & HIT_DIRECT && st.crit > 0 && w.rng() < st.crit) {
    d *= st.critMult;
    crit = true;
  }
  // Blindaje plano al golpe final (tras el crítico): los golpes fuertes y los que perforan rinden más.
  const wd = (WEAPONS as Readonly<Record<string, WeaponBase>>)[src];
  const armor =
    ((ENEMY_STATS[e.type] as EnemyStats).armor ?? 0) + (e.elite === 'blindado' ? ELITES.blindado.armor : 0);
  if (armor > 0) d = applyArmor(d, armor, wd?.armorPierce ?? 0, ARMOR.minFrac);
  // Sin contar el exceso del último golpe: el ranking no puede superar la vida real del jefe.
  if (e.boss) w.bossDmg += Math.min(d, Math.max(0, e.hp));
  e.hp -= d;
  e.flash = 0.08;
  // Control del arma (CAMBIOS §5): ralentizar e interrumpir habilidades. Los jefes no.
  if (wd !== undefined && !e.boss) {
    if (wd.slow !== undefined) {
      e.slowK = Math.min(e.slowK, wd.slow.mult);
      if (e.slowT < wd.slow.dur) e.slowT = wd.slow.dur;
    }
    if (wd.interrupt === true) interruptEnemy(e);
  }
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
  if (e.hp <= 0) {
    killEnemy(w, e, src);
    if (flags & HIT_MELEE && w.mods.meleeHeal) heal(w, w.mods.meleeHeal);
  } else if (flags & HIT_MELEE && !e.boss && w.mods.meleeStun && w.rng() < w.mods.meleeStun / 100) {
    e.stun = Math.max(e.stun, TREE_FX.stunDur);
  }
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
    acidPatch(w, x, y);
    const k = queryEnemies(w, x, y, A.boomR, out);
    for (let j = 0; j < k; j++) hitEnemy(w, w.enemies.items[out[j]!]!, A.boomEnemyDmg, 'hinchado', HIT_RAW);
    const dx = x - p.x;
    const dy = y - p.y;
    const rr = A.boomR + p.r;
    if (dx * dx + dy * dy < rr * rr) hurtPlayer(w, A.boomPlayerDmg, A.boomRad, false, hurtIndex('hinchado'));
  }
}
