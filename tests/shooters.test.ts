// Tirador especial (CAMBIOS §3): la salva del mortero cae en línea por delante del jugador.
import { afterEach, describe, expect, it } from 'vitest';
import { AI, ENEMY_STATS } from '../src/config/enemies';
import { RUN } from '../src/config/run';
import { applyTuning, resetTuning } from '../src/config/tuning';
import { spawnEnemy } from '../src/engine/systems/enemies';
import { launchSalvo } from '../src/engine/systems/shooters';
import type { InputState, World } from '../src/engine/types';
import { createWorld, tick } from '../src/engine/world';

afterEach(resetTuning);
const STEP = 1 / RUN.tickHz;

function quiet(): World {
  applyTuning({ spawn: { rateMult: 0 } });
  const w = createWorld('dot', 1, { hazards: false, startWeapon: null });
  w.nextEvent = w.nextElite = w.nextHorde = Infinity;
  w.player.god = true;
  return w;
}
const run = (w: World, input: InputState, sec: number): void => {
  for (let i = 0; i < Math.round(sec * RUN.tickHz); i++) tick(w, input, STEP);
};

describe('mortero', () => {
  it('es un tirador del Acto 1 con límite y minuto de aparición', () => {
    const s = ENEMY_STATS.mortero;
    expect(s.role).toBe('shooter');
    expect(s.cap).toBeGreaterThan(0);
    expect(s.spawnFrom).toBeGreaterThan(0);
  });

  it('la salva se marca por delante del jugador, en su dirección y cayendo una tras otra', () => {
    const w = quiet();
    const p = w.player;
    p.vx = 200;
    p.vy = 0;
    const n = launchSalvo(w, 0);
    const A = AI.mortero;
    expect(n).toBe(A.shells);
    const ts = w.tele.items.slice(0, w.tele.count);
    for (let i = 0; i < n; i++) {
      expect(ts[i]!.dur).toBeCloseTo(A.warn + i * A.stagger);
      expect(ts[i]!.y).toBeCloseTo(p.y);
      // El primero, donde estaría al caer; los demás, en línea y nunca más juntos que `minGap`.
      expect(ts[i]!.x).toBeCloseTo(p.x + 200 * A.warn + i * Math.max(200 * A.stagger, A.minGap));
    }
  });

  it('quieto, la línea empieza en él y sigue hacia donde mira', () => {
    const w = quiet();
    const p = w.player;
    p.vx = p.vy = 0;
    p.facingX = 0;
    p.facingY = 1;
    launchSalvo(w, 0);
    const ts = w.tele.items.slice(0, w.tele.count);
    expect(ts[0]!.x).toBeCloseTo(p.x);
    expect(ts[0]!.y).toBeCloseTo(p.y);
    expect(ts[1]!.y - ts[0]!.y).toBeCloseTo(AI.mortero.minGap);
  });

  for (const [name, turn, hit] of [
    ['seguir recto se come la salva', false, true],
    ['cambiar de dirección la esquiva', true, false],
  ] as const) {
    it(name, () => {
      const w = quiet();
      const p = w.player;
      const e = spawnEnemy(w, 'mortero', p.x - 400, p.y + 200, false);
      e.timer = 99;
      run(w, { moveX: 1, moveY: 0 }, 0.3);
      e.timer = 0;
      run(w, { moveX: 1, moveY: 0 }, STEP);
      expect(w.tele.count).toBe(AI.mortero.shells);
      e.timer = 99;
      run(
        w,
        turn ? { moveX: 0, moveY: -1 } : { moveX: 1, moveY: 0 },
        AI.mortero.warn + AI.mortero.shells * AI.mortero.stagger + 0.2,
      );
      expect(w.rs.shellsHit + w.rs.shellsDodged).toBe(AI.mortero.shells);
      if (hit) expect(w.rs.shellsHit).toBeGreaterThanOrEqual(AI.mortero.shells - 1);
      else expect(w.rs.shellsHit).toBe(0);
    });
  }
});
