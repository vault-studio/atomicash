// Aparición de enemigos por oleadas (F1-05): ritmo y máximo según el minuto, siempre fuera de cámara.
import { type StatEnemyId } from '../../config/enemies';
import { SPAWN, WAVES, type WaveDef } from '../../config/waves';
import type { Enemy, World } from '../types';
import { offscreenDistance } from '../view';
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

export function updateSpawning(w: World, dt: number): void {
  const waveIdx = currentWaveIndex(w.time);
  const wave = WAVES[waveIdx]!;
  const pool = w.enemies;

  // Los que se quedan muy atrás vuelven a aparecer delante, fuera de cámara.
  const p = w.player;
  const R2 = SPAWN.relocateDist * SPAWN.relocateDist;
  for (let i = 0; i < pool.count; i++) {
    const e = pool.items[i] as Enemy;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    if (dx * dx + dy * dy > R2) {
      placeOffscreen(w, spot);
      e.x = e.prevX = spot.x;
      e.y = e.prevY = spot.y;
    }
  }

  w.spawnAcc += wave.rate * dt;
  while (w.spawnAcc >= 1) {
    w.spawnAcc -= 1;
    if (pool.count >= wave.max) {
      // Al tope: no se acumulan apariciones pendientes para cuando mueran.
      w.spawnAcc = 0;
      break;
    }
    placeOffscreen(w, spot);
    spawnEnemy(w, pickType(w, waveIdx), spot.x, spot.y);
  }
}
