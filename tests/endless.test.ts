// Modo infinito tras el Coloso.
import { describe, expect, it } from 'vitest';
import { ENDLESS } from '../src/config/modes';
import { RUN } from '../src/config/run';
import { hitEnemy } from '../src/engine/systems/combat';
import { spawnEnemy } from '../src/engine/systems/enemies';
import { applyChoice } from '../src/engine/systems/progression';
import type { InputState, World } from '../src/engine/types';
import { createWorld, results, tick } from '../src/engine/world';
import { toSubmission } from '../src/online/online';

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

describe('modo infinito', () => {
  it('tras el Coloso se puede seguir: sin Tormenta, más duro, sin jefes y con un élite cada 15 s', () => {
    const w = quiet();
    const c = spawnEnemy(w, 'coloso', w.player.x + 400, w.player.y, false);
    hitEnemy(w, c, 1e9, 'llave', 4);
    expect(w.choice?.type).toBe('endless');
    applyChoice(w, 0);
    expect(w.endless).toBe(true);
    expect(w.over).toBe(false);
    w.time = RUN.stormStart + 5;
    w.nextElite = w.time;
    run(w, 1);
    expect(w.storm).toBe(false);
    expect(w.bossAlive).toBe(0);
    expect(w.nextElite).toBeCloseTo(w.time + ENDLESS.eliteEvery - 1, 0);
    w.endlessAt = w.time - 60 * 4;
    const e = spawnEnemy(w, 'dron', w.player.x + 500, w.player.y, false);
    expect(e.maxHp).toBeGreaterThan(8 * (1 + w.time / 250) * (1 + 3.9 * ENDLESS.hpPerMin));
    const r = results(w);
    expect(r.endless).toBe(true);
    const sub = toSubmission(r);
    expect(sub.timeSec).toBe(Math.floor(r.winTime));
    expect(sub.endlessSec).toBeGreaterThan(0);
  });
});
