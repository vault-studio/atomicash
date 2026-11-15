// Hordas en formación: aviso, dirección y llegada.
import { describe, expect, it } from 'vitest';
import { RUN } from '../src/config/run';
import { ENTITIES } from '../src/config/entities';
import { HORDES } from '../src/config/waves';
import { announceHorde } from '../src/engine/systems/spawning';
import { type Enemy, type InputState, type World } from '../src/engine/types';
import { isOnScreen } from '../src/engine/view';
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

const alive = (w: World): Enemy[] => w.enemies.items.slice(0, w.enemies.count).filter((e) => !e.dead);

describe('hordas en formación', () => {
  for (const kind of HORDES.order) {
    it(`${kind}: avisa y llega fuera de cámara tras el aviso`, () => {
      const w = quiet();
      announceHorde(w, kind);
      expect(w.horde?.kind).toBe(kind);
      run(w, HORDES.warn - 0.1);
      expect(alive(w)).toHaveLength(0);
      const before = w.nextId;
      run(w, 0.2);
      const fresh = alive(w).filter((e) => e.id >= before);
      expect(w.horde).toBeNull();
      expect(fresh.length).toBeGreaterThanOrEqual(HORDES[kind].count);
      for (const e of fresh) expect(ENTITIES[e.type].act).toBe(w.act);
      expect(fresh.filter((e) => isOnScreen(w, e.prevX, e.prevY))).toEqual([]);
      if (kind !== 'ring') expect(fresh.every((e) => e.march > 0)).toBe(true);
    });
  }

  it('la estampida sigue recta aunque el jugador no esté en su camino', () => {
    const w = quiet();
    announceHorde(w, 'stampede');
    run(w, HORDES.warn + 0.05);
    const e = alive(w)[0]!;
    const dx = e.dx;
    const dy = e.dy;
    w.player.x += 500;
    run(w, 0.5);
    expect(e.dx).toBe(dx);
    expect(e.dy).toBe(dy);
  });
});
