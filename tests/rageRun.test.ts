// Furia de los enemigos dentro de una partida (las reglas puras están en rage.test.ts).
import { describe, expect, it } from 'vitest';
import { ENEMY_STATS, RAGE } from '../src/config/enemies';
import { RUN } from '../src/config/run';
import { spawnEnemy } from '../src/engine/systems/enemies';
import { spawnElite } from '../src/engine/systems/spawning';
import { type InputState, type World } from '../src/engine/types';
import { createWorld, tick } from '../src/engine/world';

const STEP = 1 / RUN.tickHz;

const STILL: InputState = { moveX: 0, moveY: 0 };

function quiet(seed = 1): World {
  const w = createWorld('dot', seed, { startWeapon: null, hazards: false });
  w.nextElite = Infinity;
  w.nextSpecial = Infinity;
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

describe('furia', () => {
  it('los normales se enfurecen tras `chaseAfter` s: más daño y vida, y se les pasa a los `dur` s', () => {
    const w = quiet();
    w.level = RAGE.minLevel;
    const e = spawnEnemy(w, 'dron', w.player.x + 2000, w.player.y, false);
    const s = ENEMY_STATS.dron;
    run(w, RAGE.chaseAfter - 0.5);
    expect(e.rage).toBe(false);
    expect(e.dmg).toBe(s.dmg);
    const hp = e.hp;
    const maxHp = e.maxHp;
    run(w, 1);
    expect(e.rage).toBe(true);
    expect(e.hp).toBeCloseTo(hp * RAGE.hp);
    expect(e.maxHp).toBeCloseTo(maxHp * RAGE.hp);
    expect(e.dmg).toBeCloseTo(s.dmg * RAGE.dmg);
    run(w, RAGE.dur);
    expect(e.rage).toBe(false);
    expect(e.dmg).toBeCloseTo(s.dmg);
  });

  it('no hay furia hasta el nivel mínimo, y luego cuenta desde que se alcanza', () => {
    const w = quiet();
    w.level = RAGE.minLevel - 1;
    const e = spawnEnemy(w, 'dron', w.player.x + 2000, w.player.y, false);
    run(w, RAGE.chaseAfter + 5);
    expect(e.rage).toBe(false);
    w.level = RAGE.minLevel;
    run(w, RAGE.chaseAfter - 0.5);
    expect(e.rage).toBe(false);
    run(w, 1);
    expect(e.rage).toBe(true);
  });

  it('ni jefes ni élites se enfurecen', () => {
    const w = quiet();
    w.level = RAGE.minLevel;
    const elite = spawnElite(w);
    run(w, RAGE.chaseAfter + 1);
    expect(elite.rage).toBe(false);
  });
});
