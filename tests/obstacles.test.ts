import { describe, expect, it } from 'vitest';
import { ENEMY_STATS, MOB_IDS, type EnemyStats } from '../src/config/enemies';
import { PROP_RADII } from '../src/config/props';
import { RUN } from '../src/config/run';
import { hazardAt } from '../src/engine/hazards';
import { propAt } from '../src/engine/obstacles';
import { spawnEnemy } from '../src/engine/systems/enemies';
import type { World } from '../src/engine/types';
import { createWorld, tick } from '../src/engine/world';

const T = RUN.groundCell;
const STEP = 1 / RUN.tickHz;

/** El obstáculo más cercano a la salida, con su centro y radio. */
function nearestObstacle(w: World): { x: number; y: number; r: number } {
  const ci = Math.floor(w.start.x / T);
  const cj = Math.floor(w.start.y / T);
  for (let d = 1; d < 10; d++)
    for (let j = cj - d; j <= cj + d; j++)
      for (let i = ci - d; i <= ci + d; i++) {
        const k = propAt(w.seed, i, j, w.start.x, w.start.y);
        if (k >= 0) return { x: (i + 0.5) * T, y: (j + 0.5) * T, r: PROP_RADII[k]! };
      }
  throw new Error('sin obstáculos cerca de la salida');
}

describe('obstáculos', () => {
  it('nunca hay objeto en una casilla con charco', () => {
    for (let seed = 1; seed < 6; seed++)
      for (let j = 0; j < 60; j++)
        for (let i = 0; i < 60; i++)
          if (propAt(seed, i, j, 0, 0) >= 0) expect(hazardAt(seed, i, j, 0, 0)).toBe(-1);
  });

  it('el jugador no los atraviesa y los rodea', () => {
    const w = createWorld('dot', 3, { startWeapon: null });
    const o = nearestObstacle(w);
    const p = w.player;
    p.x = o.x - o.r - p.r - 30;
    p.y = o.y;
    for (let t = 0; t < 4 / STEP; t++) {
      tick(w, { moveX: 1, moveY: 0 }, STEP);
      expect(Math.hypot(p.x - o.x, p.y - o.y)).toBeGreaterThanOrEqual(o.r + p.r - 0.5);
    }
    expect(p.x).toBeGreaterThan(o.x + o.r);
  });

  it('las balas desaparecen al darles', () => {
    const w = createWorld('dot', 3, { startWeapon: null });
    const o = nearestObstacle(w);
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
    const o = nearestObstacle(w);
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
