// IA básica de enemigos: perseguir al jugador y separarse de los vecinos con el spatial hash.
// Sin allocations: recorre el pool por índice y usa el buffer `scratch` del World.
// No usar Math.hypot en el bucle caliente: V8 reserva memoria en cada llamada (argumentos variables).
import {
  ENEMY_RULES,
  ENEMY_STATS,
  MAX_ENEMY_RADIUS,
  enemyRadius,
  type StatEnemyId,
} from '../../config/enemies';
import type { Enemy, World } from '../types';

export function createEnemy(): Enemy {
  return {
    id: 0,
    type: 'dron',
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
    r: 0,
    hp: 0,
    maxHp: 0,
    speed: 0,
    facingX: Math.SQRT1_2,
    facingY: Math.SQRT1_2,
    moving: false,
    born: 0,
  };
}

/**
 * Crea un enemigo en (x, y). Si ya hay `w.maxEnemies`, recicla el más lejano al jugador.
 * Devuelve el enemigo reinicializado.
 */
export function spawnEnemy(w: World, type: StatEnemyId, x: number, y: number): Enemy {
  const pool = w.enemies;
  let e: Enemy;
  if (pool.count >= w.maxEnemies) {
    const p = w.player;
    let far = 0;
    let farD = -1;
    for (let i = 0; i < pool.count; i++) {
      const o = pool.items[i] as Enemy;
      const d = (o.x - p.x) ** 2 + (o.y - p.y) ** 2;
      if (d > farD) {
        farD = d;
        far = i;
      }
    }
    e = pool.items[far] as Enemy;
  } else {
    e = pool.acquire();
  }
  const s = ENEMY_STATS[type];
  e.id = w.nextId++;
  e.type = type;
  e.x = e.prevX = x;
  e.y = e.prevY = y;
  e.r = enemyRadius(type);
  e.hp = e.maxHp = s.hp;
  e.speed = s.speed;
  e.facingX = Math.SQRT1_2;
  e.facingY = Math.SQRT1_2;
  e.moving = false;
  e.born = w.time;
  return e;
}

/** Elimina el enemigo de la posición `i` del pool (el último ocupa su hueco). */
export function removeEnemyAt(w: World, i: number): void {
  w.enemies.releaseAt(i);
}

export function updateEnemies(w: World, dt: number): void {
  const pool = w.enemies;
  const items = pool.items;
  const n = pool.count;
  const p = w.player;
  const grid = w.enemyGrid;
  const out = w.scratch;
  const M = w.mapSize;

  grid.build(items, n);

  for (let i = 0; i < n; i++) {
    const e = items[i] as Enemy;
    e.prevX = e.x;
    e.prevY = e.y;

    // Persecución
    let vx = 0;
    let vy = 0;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (e.speed > 0 && d > e.r + p.r) {
      vx = (dx / d) * e.speed;
      vy = (dy / d) * e.speed;
    }

    // Separación con los vecinos solapados
    let sx = 0;
    let sy = 0;
    const k = grid.query(e.x, e.y, e.r, MAX_ENEMY_RADIUS, out);
    for (let j = 0; j < k && j < ENEMY_RULES.maxNeighbors; j++) {
      const oi = out[j]!;
      if (oi === i) continue;
      const o = items[oi] as Enemy;
      let ox = e.x - o.x;
      let oy = e.y - o.y;
      let od = Math.sqrt(ox * ox + oy * oy);
      if (od < 1e-6) {
        // Centros coincidentes: separa en una dirección determinista según el orden en el pool.
        ox = i < oi ? 1 : -1;
        oy = 0;
        od = 1;
      }
      const overlap = e.r + o.r - od;
      if (overlap > 0) {
        const push = Math.min(overlap, ENEMY_RULES.separationMaxPush) * ENEMY_RULES.separationShare;
        sx += (ox / od) * push;
        sy += (oy / od) * push;
      }
    }

    const nx = e.x + vx * dt + sx;
    const ny = e.y + vy * dt + sy;
    e.x = nx < e.r ? e.r : nx > M - e.r ? M - e.r : nx;
    e.y = ny < e.r ? e.r : ny > M - e.r ? M - e.r : ny;

    e.moving = vx !== 0 || vy !== 0;
    if (e.moving) {
      const l = Math.sqrt(vx * vx + vy * vy);
      e.facingX = vx / l;
      e.facingY = vy / l;
    }
  }
}
