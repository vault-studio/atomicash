// Interceptores (CAMBIOS §2): aturdimiento tras carrera larga, inmunidad, esquiva y tope en pantalla.
import { afterEach, describe, expect, it } from 'vitest';
import { AI } from '../src/config/enemies';
import { RUN } from '../src/config/run';
import { applyTuning, resetTuning } from '../src/config/tuning';
import { spawnEnemy } from '../src/engine/systems/enemies';
import { createWorld, tick } from '../src/engine/world';
import type { World } from '../src/engine/types';

const STEP = 1 / RUN.tickHz;
afterEach(resetTuning);

function quietWorld(): World {
  // Sin oleadas: solo lo que pone el test.
  applyTuning({ spawn: { rateMult: 0 } });
  const w = createWorld('dot', 3, { hazards: false, startWeapon: null });
  w.player.god = true;
  return w;
}

const run = (w: World, s: number, mx = 0, my = 0): void => {
  for (let i = 0; i < s * RUN.tickHz; i++) tick(w, { moveX: mx, moveY: my }, STEP);
};

describe('interceptor', () => {
  it('aturde si llega tras más de 2 s de carrera, y no encadena aturdimientos', () => {
    const w = quietWorld();
    const p = w.player;
    const spd = 340;
    spawnEnemy(w, 'interceptor', p.x + spd * (AI.interceptor.stunCharge + 0.3), p.y);
    let stunnedAt = -1;
    for (let i = 0; i < 4 * RUN.tickHz && stunnedAt < 0; i++) {
      tick(w, { moveX: 0, moveY: 0 }, STEP);
      if (p.stun > 0) stunnedAt = w.time;
    }
    expect(stunnedAt).toBeGreaterThan(AI.interceptor.stunCharge);
    expect(w.rs.stuns).toBe(1);
    // Aturdido no se mueve aunque se intente.
    const x0 = p.x;
    tick(w, { moveX: 1, moveY: 0 }, STEP);
    expect(p.x).toBe(x0);
    // Durante la inmunidad no vuelve a aturdir aunque lo alcance otro con carrera larga.
    spawnEnemy(w, 'interceptor', p.x - spd * (AI.interceptor.stunCharge + 0.3), p.y);
    run(w, AI.interceptor.stunCharge + 0.5);
    expect(w.rs.stuns).toBe(1);
  });

  it('no aturde con una carrera corta', () => {
    const w = quietWorld();
    const p = w.player;
    spawnEnemy(w, 'interceptor', p.x + 200, p.y);
    run(w, 1);
    expect(w.rs.chargesHit).toBeGreaterThan(0);
    expect(w.rs.stuns).toBe(0);
  });

  it('el autoataque sigue durante el aturdimiento', () => {
    applyTuning({ spawn: { rateMult: 0 } });
    const w = createWorld('dot', 3, { hazards: false });
    w.player.god = true;
    w.player.stun = 5;
    w.player.stunImmune = 5;
    spawnEnemy(w, 'necrofago', w.player.x + 150, w.player.y);
    run(w, 2);
    expect(w.dmgTotal).toBeGreaterThan(0);
  });

  it('un cambio brusco de dirección en el momento justo lo esquiva', () => {
    const w = quietWorld();
    const p = w.player;
    // Viene de frente por la derecha mientras el jugador huye en vertical: al acercarse, el jugador cambia de sentido.
    spawnEnemy(w, 'interceptor', p.x + 700, p.y);
    let dir = 1;
    for (let i = 0; i < 4 * RUN.tickHz; i++) {
      const e = w.enemies.items[0]!;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < 140 && dir === 1) dir = -1;
      tick(w, { moveX: 0, moveY: dir }, STEP);
    }
    expect(w.rs.chargesDodged).toBeGreaterThan(0);
  });

  it('nunca hay más de 2 en pantalla', () => {
    const w = createWorld('dot', 5, { hazards: false });
    w.player.god = true;
    applyTuning({ waves: [{ from: 0, rate: 20, max: 60, mix: { interceptor: 5, necrofago: 1 } }] });
    let most = 0;
    for (let i = 0; i < 20 * RUN.tickHz; i++) {
      tick(w, { moveX: 0, moveY: 0 }, STEP);
      let n = 0;
      for (let k = 0; k < w.enemies.count; k++) if (w.enemies.items[k]!.type === 'interceptor') n++;
      most = Math.max(most, n);
    }
    expect(most).toBe(2);
  });
});
