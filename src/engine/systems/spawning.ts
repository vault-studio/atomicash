// Director de cada acto: oleadas fuera de cámara (F1-05), eventos especiales (emboscadas y lluvias), jefes (F2-05/F2-07)
// y élites. La transición entre actos está en campaign.ts.
import { CAMPAIGN, type ActId, type SpecialRain } from '../../config/acts';
import {
  BOSS_IDS,
  ELITES,
  ELITE_IDS,
  ENEMY_RULES,
  ENEMY_STATS,
  type EnemyRole,
  type EnemyStats,
  type StatEnemyId,
} from '../../config/enemies';
import { ENTITIES } from '../../config/entities';
import { tuningVersion } from '../../config/tuning';
import { planRing } from '../encircle';
import { underCap } from '../rules';
import { BUILDINGS } from '../../config/props';
import { DAILY, ENDLESS } from '../../config/modes';
import {
  EVENTS,
  HORDES,
  SPAWN,
  WAVES,
  type HordeKind,
  type HordeType,
  type WaveDef,
} from '../../config/waves';
import { banner } from '../fx';
import { SFX, sfx } from '../sfx';
import type { Enemy, World } from '../types';
import { offscreenDistance } from '../view';
import { actTime, eliteDelay, nextSpecialAt } from './campaign';
import { addChest } from './combat';
import { makeElite, spawnEnemy } from './enemies';
import { startDownpour } from './rains';

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
function waveMix(i: number): { types: StatEnemyId[]; weights: number[] } {
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

const canElite = (w: World, t: StatEnemyId): boolean => spawnable(w, t) && !ELITES.exclude.includes(t);

/** Tipo al azar según los pesos de la oleada, entre los que cumplen `can`; null si ninguno. */
function pickType(
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

const spot = { x: 0, y: 0 };
const TAU = Math.PI * 2;

/** Punto en un anillo de radio `d ± jitter` alrededor del jugador. */
function ringPos(w: World, d: number, jitter: number): void {
  const p = w.player;
  const a = w.rng() * TAU;
  const dd = d + (w.rng() * 2 - 1) * jitter;
  spot.x = p.x + Math.cos(a) * dd;
  spot.y = p.y + Math.sin(a) * dd;
}

export function spawnBoss(w: World, kind: (typeof BOSS_IDS)[number]): void {
  w.bossSpawned[kind] = true;
  w.lastBossAt = w.time;
  ringPos(w, ENEMY_RULES.bossSpawnDist, SPAWN.jitter);
  spawnEnemy(w, kind, spot.x, spot.y, false);
  sfx(w, SFX.boss);
  banner(w, 'banner.boss', { boss: kind });
}

export type SpecialKind = HordeKind | SpecialRain;

/**
 * Qué evento especial toca: con `u` ∈ [0, 1) se decide entre emboscada (probabilidad `hordeChance`) y lluvia, y con
 * `v` ∈ [0, 1) cuál dentro del grupo.
 */
export function rollSpecial(u: number, v: number, hordeChance: number): SpecialKind {
  const list: readonly SpecialKind[] = u < hordeChance ? HORDES.order : CAMPAIGN.specials.rains;
  return list[Math.floor(v * list.length)]!;
}

/** Lanza un evento especial: una emboscada o una lluvia. */
function fireSpecial(w: World): void {
  const chance = w.dailyMod === 'hordes' ? DAILY.hordes.chance : CAMPAIGN.specials.hordeChance;
  const kind = rollSpecial(w.rng(), w.rng(), chance);
  if (kind === 'ring' || kind === 'stampede' || kind === 'wall') announceHorde(w, kind);
  // Sin mapa (pruebas) las lluvias de chatarra y ácido no tienen dónde caer.
  else if (kind === 'radioactive' || !w.hazardsOn) {
    w.rain = EVENTS.rain.dur;
    banner(w, 'banner.rain');
  } else startDownpour(w, kind);
}

/** Élite: un enemigo de la oleada vigente, de su acto y ya desbloqueado, con un prefijo al azar, fuera de cámara. */
export function spawnElite(w: World): Enemy {
  const waveIdx = currentWaveIndex(w.act, actTime(w));
  const type =
    pickType(w, waveIdx, canElite) ??
    // Todo lo elegible está en su tope: un enemigo cualquiera de la oleada que pueda ser élite.
    waveMix(waveIdx).types.find((t) => !ELITES.exclude.includes(t))!;
  const kind = ELITE_IDS[(w.rng() * ELITE_IDS.length) | 0]!;
  placeOffscreen(w, spot);
  const e = spawnEnemy(w, type, spot.x, spot.y, false);
  makeElite(e, kind);
  sfx(w, SFX.boss);
  banner(w, 'banner.elite', { elite: kind, enemy: type });
  return e;
}

/** Primer tipo de la lista que pueda salir ya; el último siempre está desbloqueado (`validateConfig`). */
function hordeType(w: World, types: readonly HordeType[]): HordeType {
  for (const x of types) if (spawnable(w, x.type)) return x;
  return types[types.length - 1]!;
}

function hordeCount(H: { count: number; perMin: number; max: number }, t: number, mult = 1): number {
  return Math.round(Math.min(H.max, H.count + (H.perMin * t) / 60) * mult);
}

/** Anuncia una horda: el HUD marca el borde de la pantalla por donde llegará. */
export function announceHorde(w: World, kind?: HordeKind): void {
  const k = kind ?? HORDES.order[w.hordeIdx++ % HORDES.order.length]!;
  const a = w.rng() * TAU;
  w.horde = { kind: k, t: HORDES.warn, ax: Math.cos(a), ay: Math.sin(a) };
  sfx(w, SFX.boss);
  banner(w, `banner.horde.${k}`);
}

/** Suelta la horda anunciada, en formación y fuera de cámara. */
function releaseHorde(w: World): void {
  const h = w.horde!;
  w.horde = null;
  const p = w.player;
  const t = w.time;
  const M = HORDES.margin;
  if (h.kind === 'ring') {
    // Cerco de varios roles con una salida (CAMBIOS §4). Solo al soltar la horda: aquí sí se pueden crear listas.
    const H = HORDES.ring;
    const mix = H.mix[w.act];
    const ids = (Object.keys(mix) as StatEnemyId[]).filter((id) => spawnable(w, id));
    if (ids.length === 0) return;
    const plan = planRing(
      hordeCount(H, t, H.actCount[w.act]),
      H.gap,
      H.heavyEvery,
      ids.map((id) => mix[id]!),
      ids.map((id) => ENEMY_STATS[id].role === 'heavy'),
      w.rng,
    );
    for (let i = 0; i < plan.angles.length; i++) {
      const ux = Math.cos(plan.angles[i]!);
      const uy = Math.sin(plan.angles[i]!);
      const d = offscreenDistance(w, ux, uy) + M;
      spawnEnemy(w, ids[plan.slots[i]!]!, p.x + ux * d, p.y + uy * d);
    }
    return;
  }
  // Estampida y muro llegan desde (ax, ay) y marchan hacia el lado contrario.
  const D = offscreenDistance(w, h.ax, h.ay) + M;
  const mx = -h.ax;
  const my = -h.ay;
  // Perpendicular a la marcha.
  const px = -my;
  const py = mx;
  const cx = p.x + h.ax * D;
  const cy = p.y + h.ay * D;
  if (h.kind === 'stampede') {
    const H = HORDES.stampede;
    const { type, count } = hordeType(w, H.types[w.act]);
    const n = hordeCount(H, t, count);
    const cols = Math.max(3, Math.round(Math.sqrt(n * 1.5)));
    for (let i = 0; i < n; i++) {
      const col = i % cols;
      const row = (i / cols) | 0;
      const side = (col / (cols - 1) - 0.5) * H.width + (row % 2 ? H.rowGap / 2 : 0);
      const back = row * H.rowGap + w.rng() * 8;
      const e = spawnEnemy(w, type, cx + px * side - mx * back, cy + py * side - my * back);
      e.speed *= H.speed;
      e.dx = mx;
      e.dy = my;
      // Lo justo para cruzar la pantalla de lado a lado.
      e.march = (2 * D + back) / e.speed;
    }
  } else {
    const H = HORDES.wall;
    const { type, count } = hordeType(w, H.types[w.act]);
    const n = hordeCount(H, t, count);
    for (let i = 0; i < n; i++) {
      const side = (i - (n - 1) / 2) * H.spacing;
      const e = spawnEnemy(w, type, cx + px * side, cy + py * side);
      e.dx = mx;
      e.dy = my;
      e.march = D / e.speed + H.extra;
    }
  }
}

function updateSpecials(w: World, dt: number): void {
  // Élites y eventos descansan mientras hay un jefe (se retrasan, no se pierden).
  if (w.bossAlive > 0) {
    if (w.nextElite < w.time + SPAWN.specialsBossDelay) w.nextElite = w.time + SPAWN.specialsBossDelay;
    if (!w.horde && w.nextSpecial < w.time + SPAWN.specialsBossDelay)
      w.nextSpecial = w.time + SPAWN.specialsBossDelay;
  }
  if (w.time >= w.nextElite) {
    spawnElite(w);
    w.nextElite = w.time + (w.endless ? ENDLESS.eliteEvery : eliteDelay(w));
  }
  if (w.horde) {
    // Una horda avisada antes del jefe espera a que muera.
    if (w.bossAlive === 0) w.horde.t -= dt;
    if (w.horde.t <= 0) releaseHorde(w);
  } else if (w.time >= w.nextSpecial) {
    fireSpecial(w);
    w.specialIdx++;
    w.nextSpecial = nextSpecialAt(w);
  }
}

/** Pone a `n` cosas repartidas en un anillo alrededor del edificio, cada una con su ángulo. */
function aroundBuilding(w: World, x: number, y: number, k: number, n: number): void {
  const a = ((k + w.rng() * 0.5) / n) * TAU;
  const d = BUILDINGS.ring + (w.rng() * 2 - 1) * BUILDINGS.jitter;
  spot.x = x + Math.cos(a) * d;
  spot.y = y + Math.sin(a) * d;
}

/** La primera vez que el jugador se acerca a un edificio, aparece lo que lo rodea: su guarnición o cajas. */
function updateGarrisons(w: World): void {
  const p = w.player;
  const D2 = BUILDINGS.trigger * BUILDINGS.trigger;
  for (let b = 0; b < w.buildings.length; b++) {
    const B = w.buildings[b]!;
    if ((B.x - p.x) ** 2 + (B.y - p.y) ** 2 > D2 || w.garrisoned.has(B.key)) continue;
    if (B.kind === 'supply') {
      w.garrisoned.add(B.key);
      const C = BUILDINGS.crates;
      const n = C.min + Math.floor(w.rng() * (C.max - C.min + 1));
      for (let k = 0; k < n; k++) {
        // Del lado derecho (−45°) a la esquina delantera (+45°): la cara del edificio que da a la cámara.
        const a = ((k + 0.25 + w.rng() * 0.5) / n - 0.5) * (TAU / 4);
        const d = BUILDINGS.chest.ring + w.rng() * BUILDINGS.chest.spread;
        addChest(w, 'crate', B.x + Math.cos(a) * d, B.y + Math.sin(a) * d, 16);
      }
      continue;
    }
    // Solo lo que ya pueda salir; si aún no hay nada, el edificio espera a que se vuelva a pasar cerca.
    const groups = BUILDINGS.enemies[w.act][B.kind].filter(([type]) => spawnable(w, type));
    let n = 0;
    for (const [, count] of groups) n += count;
    if (n === 0) continue;
    w.garrisoned.add(B.key);
    const gar = w.garrisons.length;
    w.garrisons.push({ x: B.x + BUILDINGS.cache.offset, y: B.y + BUILDINGS.cache.offset, left: n });
    let k = 0;
    for (const [type, count] of groups)
      for (let c = 0; c < count; c++) {
        aroundBuilding(w, B.x, B.y, k++, n);
        spawnEnemy(w, type, spot.x, spot.y).gar = gar;
      }
  }
}

export function updateSpawning(w: World, dt: number): void {
  // Con un jefe vivo los edificios esperan: su guarnición saldrá cuando se vuelva a pasar cerca.
  if (w.bossAlive === 0) updateGarrisons(w);
  const waveIdx = currentWaveIndex(w.act, actTime(w));
  const wave = WAVES[waveIdx]!;
  const pool = w.enemies;

  // Los que se quedan muy atrás vuelven a aparecer delante, fuera de cámara (los jefes y las guarniciones no).
  const p = w.player;
  const R2 = SPAWN.relocateDist * SPAWN.relocateDist;
  for (let i = 0; i < pool.count; i++) {
    const e = pool.items[i] as Enemy;
    if (e.boss || e.gar >= 0 || e.dead) continue;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    if (dx * dx + dy * dy > R2) {
      placeOffscreen(w, spot);
      e.x = e.prevX = spot.x;
      e.y = e.prevY = spot.y;
      // Una estampida que ya cruzó vuelve como enemigo normal.
      e.march = 0;
    }
  }

  // Infinito: cada minuto, más ritmo y más tope (hasta el máximo de enemigos del mundo).
  const em = w.endless ? (w.time - w.endlessAt) / 60 : 0;
  const maxAlive = Math.min(w.maxEnemies, wave.max * (1 + em * ENDLESS.maxPerMin));
  const rate =
    (1 + em * ENDLESS.ratePerMin) *
    wave.rate *
    SPAWN.rateMult *
    (w.rain > 0 ? EVENTS.rain.spawnMult : 1) *
    (w.bossAlive > 0 ? SPAWN.bossRateMult : 1);
  w.spawnAcc += rate * dt;
  let alive = pool.count - w.bossAlive;
  while (w.spawnAcc >= 1) {
    w.spawnAcc -= 1;
    if (alive >= maxAlive) {
      // Al tope: no se acumulan apariciones pendientes para cuando mueran.
      w.spawnAcc = 0;
      break;
    }
    const type = pickType(w, waveIdx);
    if (!type) break;
    if (type === 'torreta')
      ringPos(w, (SPAWN.staticMin + SPAWN.staticMax) / 2, (SPAWN.staticMax - SPAWN.staticMin) / 2);
    else placeOffscreen(w, spot);
    spawnEnemy(w, type, spot.x, spot.y);
    alive++;
  }

  updateSpecials(w, dt);
  if (w.rain > 0) w.rain -= dt;

  // Cada jefe, a su hora dentro de su acto. Ninguno vuelve en infinito.
  const boss = CAMPAIGN.acts[w.act].boss;
  if (!w.endless && !w.bossSpawned[boss] && actTime(w) >= CAMPAIGN.bossAt) spawnBoss(w, boss);
}
