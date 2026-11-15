// Cinemática de victoria al derrotar al Coloso.
import { describe, expect, it } from 'vitest';
import { RUN } from '../src/config/run';
import { addPickup, killEnemy } from '../src/engine/systems/combat';
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

describe('cinemática de victoria', () => {
  it('la pide la máquina de cupones al recogerla, no las bajas de élites ni de jefes', () => {
    const w = quiet();
    killEnemy(w, spawnElite(w), 'llave');
    killEnemy(w, spawnEnemy(w, 'rey_rata', w.player.x + 300, w.player.y), 'llave');
    expect(w.victory).toBe(false);
    addPickup(w, 'cache', w.player.x, w.player.y, 10);
    tick(w, STILL, STEP);
    expect(w.victory).toBe(true);
    expect(w.choice?.type).toBe('cache');
  });
});
