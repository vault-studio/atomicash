// Director de la run: oleadas fuera de cámara (F1-05), eventos y jefes (F2-05/F2-07).
import { BOSSES, BOSS_IDS, ENEMY_RULES, type StatEnemyId } from '../../config/enemies';
import { EVENTS, SPAWN, WAVES, type WaveDef } from '../../config/waves';
import { banner } from '../fx';
import { SFX, sfx } from '../sfx';
import type { Enemy, World } from '../types';
import { offscreenDistance } from '../view';
import { addPickup } from './combat';
import { spawnEnemy } from './enemies';

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

/**
 * Elige un punto fuera de cámara alrededor del jugador y lo escribe en `out`.
 * Prueba varios ángulos para no salirse del mapa; si no puede, lo pega al borde.
 */
export function placeOffscreen(w: World, out: { x: number; y: number }): void {
  const p = w.player;
  const M = w.mapSize;
  let x = p.x;
  let y = p.y;
  for (let i = 0; i < SPAWN.placeTries; i++) {
    const a = w.rng() * Math.PI * 2;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const base = offscreenDistance(w, ux, uy) + SPAWN.offscreenMargin;
    const d = (base > SPAWN.minDist ? base : SPAWN.minDist) + w.rng() * SPAWN.jitter;
    x = p.x + ux * d;
    y = p.y + uy * d;
    if (x >= 0 && x <= M && y >= 0 && y <= M) break;
  }
  out.x = x < 0 ? 0 : x > M ? M : x;
  out.y = y < 0 ? 0 : y > M ? M : y;
}

const spot = { x: 0, y: 0 };
const TAU = Math.PI * 2;
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** Punto en un anillo de radio `d ± jitter` alrededor del jugador. */
function ringPos(w: World, d: number, jitter: number): void {
  const p = w.player;
  const M = w.mapSize;
  const a = w.rng() * TAU;
  const dd = d + (w.rng() * 2 - 1) * jitter;
  spot.x = clamp(p.x + Math.cos(a) * dd, 20, M - 20);
  spot.y = clamp(p.y + Math.sin(a) * dd, 20, M - 20);
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
  const M = w.mapSize;
  if (kind === 'supply') {
    const a = w.rng() * TAU;
    const S = EVENTS.supply;
    addPickup(
      w,
      'crate',
      clamp(p.x + Math.cos(a) * S.dist, 60, M - 60),
      clamp(p.y + Math.sin(a) * S.dist, 60, M - 60),
      16,
    );
    banner(w, 'banner.supply');
  } else if (kind === 'swarm') {
    const S = EVENTS.swarm;
    for (let i = 0; i < S.count; i++) {
      const a = (i / S.count) * TAU;
      spawnEnemy(
        w,
        S.type,
        clamp(p.x + Math.cos(a) * S.r, 10, M - 10),
        clamp(p.y + Math.sin(a) * S.r, 10, M - 10),
      );
    }
    banner(w, 'banner.swarm');
  } else {
    w.rain = EVENTS.rain.dur;
    banner(w, 'banner.rain');
  }
}

export function updateSpawning(w: World, dt: number): void {
  const waveIdx = currentWaveIndex(w.time);
  const wave = WAVES[waveIdx]!;
  const pool = w.enemies;

  // Los que se quedan muy atrás vuelven a aparecer delante, fuera de cámara (los jefes no).
  const p = w.player;
  const R2 = SPAWN.relocateDist * SPAWN.relocateDist;
  for (let i = 0; i < pool.count; i++) {
    const e = pool.items[i] as Enemy;
    if (e.boss || e.dead) continue;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    if (dx * dx + dy * dy > R2) {
      placeOffscreen(w, spot);
      e.x = e.prevX = spot.x;
      e.y = e.prevY = spot.y;
    }
  }

  const rate =
    wave.rate * (w.rain > 0 ? EVENTS.rain.spawnMult : 1) * (w.bossAlive > 0 ? SPAWN.bossRateMult : 1);
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
  if (w.rain > 0) w.rain -= dt;
  for (const k of BOSS_IDS) if (!w.bossSpawned[k] && w.time >= BOSSES[k].at) spawnBoss(w, k);
}
