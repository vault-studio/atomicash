import { describe, expect, it } from 'vitest';
import { ENEMY_STATS, MOB_IDS, type EnemyStats } from '../src/config/enemies';
import { BUILDINGS, PROP_LIST, PROP_SHAPES } from '../src/config/props';
import { RUN } from '../src/config/run';
import { hazardAt } from '../src/engine/hazards';
import { createCellObject, objectAt } from '../src/engine/obstacles';
import { spawnEnemy } from '../src/engine/systems/enemies';
import type { World } from '../src/engine/types';
import { createWorld, tick } from '../src/engine/world';

const T = RUN.groundCell;
const STEP = 1 / RUN.tickHz;
const cell = createCellObject();

/** El objeto de una casilla más cercano a la salida, con su centro y radio. */
function nearestSingle(w: World): { x: number; y: number; r: number } {
  const ci = Math.floor(w.start.x / T);
  const cj = Math.floor(w.start.y / T);
  for (let d = 1; d < 12; d++)
    for (let j = cj - d; j <= cj + d; j++)
      for (let i = ci - d; i <= ci + d; i++)
        if (objectAt(w.seed, i, j, w.start.x, w.start.y, cell) && PROP_LIST[cell.prop]!.cells === 1)
          return { x: cell.x, y: cell.y, r: PROP_SHAPES[cell.prop]!.r };
  throw new Error('sin obstáculos cerca de la salida');
}

/** Primera semilla con un edificio del tipo pedido a menos de 12 casillas de la salida. */
function worldWithBuilding(kind: string): { w: World; x: number; y: number } {
  for (let seed = 1; seed < 400; seed++) {
    const w = createWorld('dot', seed, { startWeapon: null });
    const b = w.buildings.find((x) => x.kind === kind);
    if (b) return { w, x: b.x, y: b.y };
  }
  throw new Error(`sin edificio ${kind}`);
}

describe('obstáculos', () => {
  it('nunca pisan ácido, y los de varias casillas ocupan todas las suyas sin pisarse', () => {
    for (let seed = 1; seed < 6; seed++) {
      const owner = new Map<string, string>();
      for (let j = 0; j < 80; j++)
        for (let i = 0; i < 80; i++) {
          if (!objectAt(seed, i, j, 0, 0, cell)) continue;
          expect(hazardAt(seed, i, j, 0, 0)).toBe(-1);
          owner.set(`${i},${j}`, `${cell.i},${cell.j},${cell.prop}`);
        }
      for (const [, v] of owner) {
        const [ai, aj, prop] = v.split(',').map(Number) as [number, number, number];
        const cells = PROP_LIST[prop]!.cells;
        const covered = cells === 1 ? [[0, 0]] : cells === 2 ? [[0, 0], [1, 0]] : [[0, 0], [1, 0], [0, 1], [1, 1]];
        for (const [di, dj] of covered) expect(owner.get(`${ai + di!},${aj + dj!}`)).toBe(v);
      }
    }
  });

  it('el jugador no los atraviesa y los rodea', () => {
    const w = createWorld('dot', 3, { startWeapon: null });
    const o = nearestSingle(w);
    const p = w.player;
    p.x = o.x - o.r - p.r - 30;
    p.y = o.y;
    for (let t = 0; t < 4 / STEP; t++) {
      tick(w, { moveX: 1, moveY: 0 }, STEP);
      expect(Math.hypot(p.x - o.x, p.y - o.y)).toBeGreaterThanOrEqual(o.r + p.r - 0.5);
    }
    expect(p.x).toBeGreaterThan(o.x + o.r);
  });

  it('el jugador no entra en un edificio', () => {
    const { w, x, y } = worldWithBuilding('necro');
    const p = w.player;
    p.x = x - 2 * T;
    p.y = y;
    for (let t = 0; t < 3 / STEP; t++) {
      tick(w, { moveX: 1, moveY: 0 }, STEP);
      const inside = Math.abs(p.x - x) < 0.8 * T && Math.abs(p.y - y) < 0.8 * T;
      expect(inside).toBe(false);
    }
  });

  it('las balas desaparecen al darles', () => {
    const w = createWorld('dot', 3, { startWeapon: null });
    const o = nearestSingle(w);
    w.player.x = o.x - o.r - 60;
    w.player.y = o.y;
    tick(w, { moveX: 0, moveY: 0 }, STEP);
    const s = w.shots.acquire();
    Object.assign(s, { x: o.x - o.r - 20, y: o.y, vx: 600, vy: 0, r: 4, life: 2, dmg: 1, pierce: 0, nHit: 0 });
    for (let t = 0; t < 0.2 / STEP; t++) tick(w, { moveX: 0, moveY: 0 }, STEP);
    expect(w.shots.count).toBe(0);
  });

  it('los enemigos de tierra no los atraviesan', () => {
    const w = createWorld('dot', 3, { startWeapon: null });
    const o = nearestSingle(w);
    const p = w.player;
    p.x = o.x + o.r + 80;
    p.y = o.y;
    const type = MOB_IDS.find((id) => !(ENEMY_STATS[id] as EnemyStats).flying && id !== 'torreta')!;
    const id = spawnEnemy(w, type, o.x - o.r - 40, o.y, false).id;
    for (let t = 0; t < 2 / STEP; t++) {
      tick(w, { moveX: 0, moveY: 0 }, STEP);
      const e = w.enemies.items.slice(0, w.enemies.count).find((x) => x.id === id);
      if (!e || e.dead) break;
      expect(Math.hypot(e.x - o.x, e.y - o.y)).toBeGreaterThanOrEqual(o.r + e.r - 0.5);
    }
  });
});

describe('edificios', () => {
  it.each(['raiders', 'robots', 'necro'] as const)('%s: aparece su guarnición una sola vez al acercarse', (kind) => {
    const { w, x, y } = worldWithBuilding(kind);
    const p = w.player;
    p.x = x - BUILDINGS.trigger + 50;
    p.y = y;
    const types = (): string[] =>
      w.enemies.items
        .slice(0, w.enemies.count)
        .filter((e) => Math.hypot(e.x - x, e.y - y) < BUILDINGS.ring + BUILDINGS.jitter + T)
        .map((e) => e.type);
    tick(w, { moveX: 0, moveY: 0 }, STEP);
    const near = types();
    for (const [type, count] of BUILDINGS.enemies[kind])
      expect(near.filter((t) => t === type).length).toBeGreaterThanOrEqual(count);
    const before = w.enemies.count;
    tick(w, { moveX: 0, moveY: 0 }, STEP);
    expect(w.enemies.count).toBeLessThanOrEqual(before + 1);
  });

  it('el supermercado sale rodeado de 3 o 4 cajas de suministros', () => {
    const { w, x, y } = worldWithBuilding('supply');
    w.player.x = x - BUILDINGS.trigger + 50;
    w.player.y = y;
    tick(w, { moveX: 0, moveY: 0 }, STEP);
    const crates = w.pickups.items
      .slice(0, w.pickups.count)
      .filter((k) => k.kind === 'crate' && Math.hypot(k.x - x, k.y - y) < BUILDINGS.ring + BUILDINGS.jitter + 1);
    expect(crates.length).toBeGreaterThanOrEqual(BUILDINGS.crates.min);
    expect(crates.length).toBeLessThanOrEqual(BUILDINGS.crates.max);
  });
});
