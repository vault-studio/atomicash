// Barriles explosivos: mecha y cadena de explosiones.
import { describe, expect, it } from 'vitest';
import { RUN } from '../src/config/run';
import { spawnEnemy } from '../src/engine/systems/enemies';
import { explodeBarrel } from '../src/engine/systems/modes';
import type { InputState, World } from '../src/engine/types';
import { createWorld, tick } from '../src/engine/world';

const STEP = 1 / RUN.tickHz;

const STILL: InputState = { moveX: 0, moveY: 0 };

function quiet(opts = {}): World {
  const w = createWorld('dot', 1, { startWeapon: null, hazards: false, ...opts });
  w.nextSpecial = w.nextElite = w.nextObjective = Infinity;
  w.spawnAcc = -1e9;
  w.player.god = true;
  for (const k of ['rey_rata', 'dirigible', 'coloso']) w.bossSpawned[k] = true;
  return w;
}

const run = (w: World, sec: number): void => {
  for (let i = 0; i < Math.round(sec * RUN.tickHz); i++) {
    w.spawnAcc = -1e9;
    tick(w, STILL, STEP);
  }
};

describe('barriles explosivos', () => {
  it('revientan, dañan a los de alrededor y encadenan a los vecinos', () => {
    const w = quiet();
    const p = w.player;
    const e = spawnEnemy(w, 'necrofago', p.x + 300, p.y, false);
    for (const dx of [280, 360]) {
      const b = w.barrels.acquire();
      b.x = p.x + dx;
      b.y = p.y;
      b.r = 13;
      b.fuse = -1;
    }
    w.enemyGrid.build(w.enemies.items, w.enemies.count);
    explodeBarrel(w, 0);
    expect(e.hp).toBeLessThan(e.maxHp);
    expect(w.barrels.count).toBe(1);
    expect(w.barrels.items[0]!.fuse).toBeGreaterThan(0);
    run(w, 0.3);
    expect(w.barrels.count).toBe(0);
  });
});
