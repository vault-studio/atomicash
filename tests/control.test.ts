// Control de armas (CAMBIOS §5): ralentizar e interrumpir habilidades.
import { afterEach, describe, expect, it } from 'vitest';
import { AI, ENEMY_STATS } from '../src/config/enemies';
import { RUN } from '../src/config/run';
import { applyTuning, resetTuning } from '../src/config/tuning';
import { WEAPONS } from '../src/config/weapons';
import { HIT_RAW, hitEnemy } from '../src/engine/systems/combat';
import { interruptEnemy, spawnEnemy } from '../src/engine/systems/enemies';
import { MODE_AIM, MODE_CHASE, type World } from '../src/engine/types';
import { createWorld, tick } from '../src/engine/world';

afterEach(resetTuning);

function quiet(): World {
  applyTuning({ spawn: { rateMult: 0 } });
  const w = createWorld('dot', 1, { hazards: false, startWeapon: null });
  w.nextSpecial = w.nextElite = Infinity;
  w.player.god = true;
  return w;
}

describe('control', () => {
  it('el cóctel ralentiza y se pasa al acabar', () => {
    const w = quiet();
    const e = spawnEnemy(w, 'necrofago', w.player.x + 600, w.player.y, false);
    e.hp = e.maxHp = 1e6;
    hitEnemy(w, e, 1, 'coctel', HIT_RAW);
    expect(e.slowK).toBe(WEAPONS.coctel.slow!.mult);
    const x0 = e.x;
    tick(w, { moveX: 0, moveY: 0 }, 1 / RUN.tickHz);
    expect(x0 - e.x).toBeCloseTo((e.speed * WEAPONS.coctel.slow!.mult) / RUN.tickHz, 0);
    for (let i = 0; i < (WEAPONS.coctel.slow!.dur + 0.1) * RUN.tickHz; i++)
      tick(w, { moveX: 0, moveY: 0 }, 1 / RUN.tickHz);
    expect(e.slowK).toBe(1);
  });

  it('los jefes no se ralentizan ni se interrumpen', () => {
    const w = quiet();
    const e = spawnEnemy(w, 'rey_rata', w.player.x + 600, w.player.y, false);
    hitEnemy(w, e, 1, 'coctel', HIT_RAW);
    expect(e.slowK).toBe(1);
    expect(interruptEnemy(e)).toBe(false);
  });

  it('el megáfono corta la embestida que se está preparando', () => {
    const w = quiet();
    const e = spawnEnemy(w, 'saqueador', w.player.x + 200, w.player.y, false);
    e.hp = e.maxHp = 1e6;
    e.mode = MODE_AIM;
    hitEnemy(w, e, 1, 'megafono', HIT_RAW);
    expect(e.mode).toBe(MODE_CHASE);
    expect(e.timer).toBe(ENEMY_STATS.saqueador.dash!.every);
  });

  it('interrumpir corta la carrera del interceptor y la carga del mortero', () => {
    const w = quiet();
    const i = spawnEnemy(w, 'interceptor', w.player.x + 400, w.player.y, false);
    i.mt = 3;
    expect(interruptEnemy(i)).toBe(true);
    expect([i.mode, i.mt]).toEqual([MODE_AIM, 0]);
    const m = spawnEnemy(w, 'mortero', w.player.x + 400, w.player.y, false);
    m.timer = 0.1;
    expect(interruptEnemy(m)).toBe(true);
    expect(m.timer).toBe(AI.mortero.every);
  });
});
