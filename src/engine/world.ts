// Estado de la run y tick(dt). TS puro: sin React, DOM ni Pixi.
import { ENEMY_RULES } from '../config/enemies';
import { PLAYER, RUN } from '../config/run';
import { SURVIVORS, type StatSurvivorId } from '../config/survivors';
import { Pool } from './pool';
import { createRng } from './rng';
import { SpatialHash } from './spatialHash';
import { createEnemy, updateEnemies } from './systems/enemies';
import { updateSpawning } from './systems/spawning';
import type { InputState, World } from './types';
import { defaultView } from './view';

export interface WorldOptions {
  /** Enemigos simultáneos antes de reciclar el más lejano. Por defecto, ENEMY_RULES.maxAlive. */
  maxEnemies?: number;
}

export function createWorld(charId: StatSurvivorId, seed: number, opts: WorldOptions = {}): World {
  const stats = SURVIVORS[charId];
  const c = RUN.mapSize / 2;
  const maxEnemies = opts.maxEnemies ?? ENEMY_RULES.maxAlive;
  return {
    seed,
    rng: createRng(seed),
    time: 0,
    ticks: 0,
    mapSize: RUN.mapSize,
    player: {
      charId,
      x: c,
      y: c,
      prevX: c,
      prevY: c,
      r: PLAYER.radius,
      speed: stats.speed,
      hp: stats.hp,
      maxHp: stats.hp,
      // Mirando hacia abajo en pantalla (fila S del sprite) en la vista isométrica.
      facingX: Math.SQRT1_2,
      facingY: Math.SQRT1_2,
      moving: false,
      deadAt: null,
    },
    maxEnemies,
    enemies: new Pool(createEnemy, maxEnemies),
    enemyGrid: new SpatialHash(RUN.mapSize, RUN.gridCell, maxEnemies),
    scratch: new Int32Array(ENEMY_RULES.maxNeighbors * 4),
    nextId: 1,
    spawnAcc: 0,
    view: defaultView(),
  };
}

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

function updatePlayer(w: World, input: InputState, dt: number): void {
  const p = w.player;
  p.prevX = p.x;
  p.prevY = p.y;
  if (p.deadAt !== null) {
    p.moving = false;
    return;
  }
  const mag = Math.sqrt(input.moveX * input.moveX + input.moveY * input.moveY);
  p.moving = mag > PLAYER.moveDeadzone;
  if (p.moving) {
    const ux = input.moveX / mag;
    const uy = input.moveY / mag;
    const k = Math.min(1, mag) * p.speed * dt;
    p.facingX = ux;
    p.facingY = uy;
    p.x = clamp(p.x + ux * k, p.r, w.mapSize - p.r);
    p.y = clamp(p.y + uy * k, p.r, w.mapSize - p.r);
  }
}

/** Orden de sistemas (05_TECH.md §3): input → movimiento jugador → spawning → IA enemigos → … */
export function tick(w: World, input: InputState, dt: number): void {
  w.time += dt;
  w.ticks++;
  updatePlayer(w, input, dt);
  updateSpawning(w, dt);
  updateEnemies(w, dt);
}

/** Mata al jugador (daño letal o depuración). La animación `death` se reproduce desde `deadAt`. */
export function killPlayer(w: World): void {
  const p = w.player;
  if (p.deadAt !== null) return;
  p.hp = 0;
  p.deadAt = w.time;
  p.moving = false;
}
