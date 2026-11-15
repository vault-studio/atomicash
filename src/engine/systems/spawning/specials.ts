// Jefes, élites, hordas y eventos especiales (emboscadas y lluvias).
import { CAMPAIGN, type SpecialRain } from '../../../config/acts';
import {
  BOSS_IDS,
  ELITES,
  ELITE_IDS,
  ENEMY_RULES,
  ENEMY_STATS,
  type StatEnemyId,
} from '../../../config/enemies';
import { planRing } from '../../encircle';
import { DAILY, ENDLESS } from '../../../config/modes';
import { EVENTS, HORDES, SPAWN, type HordeKind, type HordeType } from '../../../config/waves';
import { banner } from '../../fx';
import { SFX, sfx } from '../../sfx';
import type { Enemy, World } from '../../types';
import { offscreenDistance } from '../../view';
import { actTime, eliteDelay, nextSpecialAt } from '../campaign';
import { makeElite, spawnEnemy } from '../enemies';
import { startDownpour } from '../rains';
import {
  TAU,
  canElite,
  currentWaveIndex,
  pickType,
  placeOffscreen,
  ringPos,
  spawnable,
  spot,
  waveMix,
} from './waves';

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

export function updateSpecials(w: World, dt: number): void {
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
