// Radiación del jugador en partida: subida, tramos y efectos.
import { describe, expect, it } from 'vitest';
import { RUN } from '../src/config/run';
import { addRad } from '../src/engine/systems/combat';
import { IRRADIATED, RAD } from '../src/config/radiation';
import { spawnEnemy } from '../src/engine/systems/enemies';
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

describe('radiación', () => {
  it('los enemigos irradiados irradian al acercarse, sin tocarte', () => {
    const w = quiet();
    const e = spawnEnemy(w, 'torreta', w.player.x + IRRADIATED.auraR * 0.5, w.player.y, false);
    e.irr = true;
    run(w, 1);
    expect(w.player.rad).toBeCloseTo(IRRADIATED.auraRad, 0);
    e.irr = false;
    const before = w.player.rad;
    run(w, 1);
    expect(w.player.rad).toBeLessThanOrEqual(before);
  });

  it('al 100 % de RAD se muere, salvo inmortal', () => {
    const w = quiet();
    w.player.rad = RAD.max - 0.5;
    run(w, STEP);
    expect(w.player.deadAt).toBeNull();
    w.player.god = false;
    w.player.rad = RAD.max - 0.01;
    addRad(w, 1);
    run(w, STEP);
    expect(w.player.deadAt).not.toBeNull();
  });

  it('si un irradiado te lleva a 100 también se muere', () => {
    const w = quiet();
    w.player.god = false;
    w.player.rad = RAD.max - 2;
    const e = spawnEnemy(w, 'torreta', w.player.x + IRRADIATED.auraR * 0.5, w.player.y, false);
    e.irr = true;
    run(w, 1);
    expect(w.player.rad).toBe(RAD.max);
    expect(w.player.deadAt).not.toBeNull();
  });
});
