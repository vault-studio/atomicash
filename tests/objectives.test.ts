// Objetivos del mapa: zonas, progreso y recompensa.
import { describe, expect, it } from 'vitest';
import { OBJECTIVES } from '../src/config/modes';
import { RUN } from '../src/config/run';
import { killEnemy } from '../src/engine/systems/combat';
import { spawnEnemy } from '../src/engine/systems/enemies';
import { startObjective } from '../src/engine/systems/modes';
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

describe('objetivos del mapa', () => {
  it('aguantar en la zona da un cofre especial y cupones', () => {
    const w = quiet();
    w.objectiveIdx = 0;
    startObjective(w);
    const o = w.objective!;
    expect(o.kind).toBe('hold');
    w.player.x = o.x;
    w.player.y = o.y;
    run(w, OBJECTIVES.hold.goal + 0.2);
    expect(w.objective).toBeNull();
    expect(w.objectivesDone).toBe(1);
    expect(w.coupons).toBe(OBJECTIVES.coupons);
    // El cofre sale en el centro de la zona, justo donde está el jugador: se abre al momento.
    expect(w.choice?.type).toBe('cache');
  });

  it('la purga cuenta las bajas con el jugador dentro de la zona, estén donde estén, y caduca si no llegas', () => {
    const w = quiet();
    w.objectiveIdx = 1;
    startObjective(w);
    const o = w.objective!;
    expect(o.kind).toBe('purge');
    // Jugador fuera: no cuenta aunque el enemigo esté en el centro de la zona.
    w.player.x = o.x + o.r * 3;
    w.player.y = o.y;
    killEnemy(w, spawnEnemy(w, 'dron', o.x, o.y), 'llave');
    expect(o.progress).toBe(0);
    // Jugador dentro: cuenta aunque el enemigo esté fuera.
    w.player.x = o.x;
    w.player.y = o.y;
    killEnemy(w, spawnEnemy(w, 'dron', o.x + o.r * 2, o.y), 'llave');
    expect(o.progress).toBe(1);
    w.player.x = o.x + o.r * 3;
    run(w, OBJECTIVES.purge.limit + 0.2);
    expect(w.objective).toBeNull();
    expect(w.objectivesDone).toBe(0);
  });
});
