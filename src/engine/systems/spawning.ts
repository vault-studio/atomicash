// Director de la run: oleadas fuera de cámara (F1-05), eventos, jefes (F2-05/F2-07), élites y hordas en formación.
import { BOSSES, BOSS_IDS, ELITES, ELITE_IDS, ENEMY_RULES, type StatEnemyId } from '../../config/enemies';
import { BUILDINGS } from '../../config/props';
import { EVENTS, HORDES, SPAWN, WAVES, type HordeKind, type WaveDef } from '../../config/waves';
import { banner } from '../fx';
import { SFX, sfx } from '../sfx';
import type { Enemy, World } from '../types';
import { offscreenDistance } from '../view';
import { addPickup } from './combat';
import { makeElite, spawnEnemy } from './enemies';

/** Oleada vigente en el segundo `t`. */
export function currentWave(t: number): WaveDef {
  let w = WAVES[0]!;
  for (const x of WAVES) if (t >= x.from) w = x;
  return w;
}

/** Índice de la oleada vigente (para depuración y HUD). */
export function currentWaveIndex(t: number): number {
  let idx = 0;
  for (let i = 0; i < WAVES.length; i++) if (t >= WAVES[i]!.from) idx = i;
  return idx;
}

// Pesos de cada oleada precalculados para no recorrer objetos en cada aparición.
const MIX = WAVES.map((wave) => {
  const types: StatEnemyId[] = [];
  const weights: number[] = [];
  let total = 0;
  for (const [id, wgt] of Object.entries(wave.mix) as [StatEnemyId, number][]) {
    if (wgt > 0) {
      types.push(id);
      weights.push(wgt);
      total += wgt;
    }
  }
  return { types, weights, total };
});

function pickType(w: World, waveIdx: number): StatEnemyId {
  const m = MIX[waveIdx]!;
  let r = w.rng() * m.total;
  for (let i = 0; i < m.types.length; i++) {
    r -= m.weights[i]!;
    if (r < 0) return m.types[i]!;
  }
  return m.types[m.types.length - 1]!;
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

function fireEvent(w: World): void {
  const kind = EVENTS.order[w.eventIdx++ % EVENTS.order.length]!;
  const p = w.player;
  if (kind === 'supply') {
    const a = w.rng() * TAU;
    const S = EVENTS.supply;
    addPickup(w, 'crate', p.x + Math.cos(a) * S.dist, p.y + Math.sin(a) * S.dist, 16);
    banner(w, 'banner.supply');
  } else if (kind === 'swarm') {
    const S = EVENTS.swarm;
    for (let i = 0; i < S.count; i++) {
      const a = (i / S.count) * TAU;
      spawnEnemy(w, S.type, p.x + Math.cos(a) * S.r, p.y + Math.sin(a) * S.r);
    }
    banner(w, 'banner.swarm');
  } else {
    w.rain = EVENTS.rain.dur;
    banner(w, 'banner.rain');
  }
}

/** Élite: un enemigo de la oleada vigente con un prefijo al azar, fuera de cámara. */
export function spawnElite(w: World): Enemy {
  const waveIdx = currentWaveIndex(w.time);
  let type = pickType(w, waveIdx);
  for (let k = 0; k < 8 && ELITES.exclude.includes(type); k++) type = pickType(w, waveIdx);
  if (ELITES.exclude.includes(type)) type = 'saqueador';
  const kind = ELITE_IDS[(w.rng() * ELITE_IDS.length) | 0]!;
  placeOffscreen(w, spot);
  const e = spawnEnemy(w, type, spot.x, spot.y, false);
  makeElite(e, kind);
  sfx(w, SFX.boss);
  banner(w, 'banner.elite', { elite: kind, enemy: type });
  return e;
}

/** Tipo de enemigo de una horda según el minuto. */
function hordeType(types: readonly { from: number; type: StatEnemyId }[], t: number): StatEnemyId {
  let id = types[0]!.type;
  for (const x of types) if (t >= x.from) id = x.type;
  return id;
}

function hordeCount(H: { count: number; perMin: number; max: number }, t: number): number {
  return Math.min(H.max, Math.round(H.count + (H.perMin * t) / 60));
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
    const H = HORDES.ring;
    const n = hordeCount(H, t);
    const type = hordeType(H.types, t);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      const d = offscreenDistance(w, ux, uy) + M;
      spawnEnemy(w, type, p.x + ux * d, p.y + uy * d);
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
    const n = hordeCount(H, t);
    const type = hordeType(H.types, t);
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
    const n = hordeCount(H, t);
    const type = hordeType(H.types, t);
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
  // Élites y hordas descansan mientras hay un jefe (se retrasan, no se pierden).
  if (w.bossAlive > 0) {
    if (w.nextElite < w.time + 10) w.nextElite = w.time + 10;
    if (!w.horde && w.nextHorde < w.time + 10) w.nextHorde = w.time + 10;
  }
  if (w.time >= w.nextElite) {
    spawnElite(w);
    w.nextElite = w.time + ELITES.everyMin + w.rng() * (ELITES.everyMax - ELITES.everyMin);
  }
  if (w.horde) {
    w.horde.t -= dt;
    if (w.horde.t <= 0) releaseHorde(w);
  } else if (w.time >= w.nextHorde) {
    announceHorde(w);
    w.nextHorde = w.time + HORDES.everyMin + w.rng() * (HORDES.everyMax - HORDES.everyMin);
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
    w.garrisoned.add(B.key);
    if (B.kind === 'supply') {
      const C = BUILDINGS.crates;
      const n = C.min + Math.floor(w.rng() * (C.max - C.min + 1));
      for (let k = 0; k < n; k++) {
        aroundBuilding(w, B.x, B.y, k, n);
        addPickup(w, 'crate', spot.x, spot.y, 16);
      }
      continue;
    }
    const groups = BUILDINGS.enemies[B.kind];
    let n = 0;
    for (const [, count] of groups) n += count;
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
  updateGarrisons(w);
  const waveIdx = currentWaveIndex(w.time);
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

  const rate =
    wave.rate *
    SPAWN.rateMult *
    (w.rain > 0 ? EVENTS.rain.spawnMult : 1) *
    (w.bossAlive > 0 ? SPAWN.bossRateMult : 1);
  w.spawnAcc += rate * dt;
  let alive = pool.count - w.bossAlive;
  while (w.spawnAcc >= 1) {
    w.spawnAcc -= 1;
    if (alive >= wave.max) {
      // Al tope: no se acumulan apariciones pendientes para cuando mueran.
      w.spawnAcc = 0;
      break;
    }
    const type = pickType(w, waveIdx);
    if (type === 'torreta')
      ringPos(w, (SPAWN.staticMin + SPAWN.staticMax) / 2, (SPAWN.staticMax - SPAWN.staticMin) / 2);
    else placeOffscreen(w, spot);
    spawnEnemy(w, type, spot.x, spot.y);
    alive++;
  }

  if (w.time >= w.nextEvent) {
    if (w.time - w.lastBossAt < EVENTS.bossQuiet) w.nextEvent = w.lastBossAt + EVENTS.bossQuiet;
    else {
      fireEvent(w);
      w.nextEvent += EVENTS.every;
    }
  }
  updateSpecials(w, dt);
  if (w.rain > 0) w.rain -= dt;

  for (const k of BOSS_IDS)
    if (!w.bossSpawned[k] && (w.time >= BOSSES[k].at || w.kills >= BOSSES[k].kills)) spawnBoss(w, k);
}
