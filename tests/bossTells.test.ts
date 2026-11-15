// Avisos de los jefes en el suelo antes de sus ataques.
import { describe, expect, it } from 'vitest';
import { AI } from '../src/config/enemies';
import { RUN } from '../src/config/run';
import { spawnEnemy } from '../src/engine/systems/enemies';
import { MODE_CHASE, type Enemy, type InputState, type World } from '../src/engine/types';
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

describe('avisos de los jefes', () => {
  it('el Rey Rata llama a las ratas parado y luego encadena embestidas avisadas, más en fase 2', () => {
    const R = AI.rey_rata;
    // Cuenta los pasillos de embestida nuevos (los avisos sin daño con dirección) hasta que acaba la tanda de `b`
    // (cada carrera dura lo que tarde en llegar al jugador, así que no se mide por tiempo).
    const lanes = (w: World, b: Enemy): number => {
      let n = 0;
      let before = 0;
      for (let i = 0; i < 20 * RUN.tickHz && !(n > 0 && b.burst === 0 && b.mode === MODE_CHASE); i++) {
        w.spawnAcc = -1e9;
        tick(w, STILL, STEP);
        const now = w.tele.items.slice(0, w.tele.count).filter((t) => t.lx !== 0 || t.ly !== 0).length;
        if (now > before) n += now - before;
        before = now;
      }
      return n;
    };
    const w = quiet();
    const e = spawnEnemy(w, 'rey_rata', w.player.x + 600, w.player.y);
    e.timer = 0;
    run(w, STEP);
    // Primero se para a llamar a las ratas.
    expect(alive(w).filter((x) => x.type === R.summonType)).toHaveLength(R.summon);
    expect(e.burst).toBe(R.chain);
    const x0 = e.x;
    run(w, R.summonStop / 2);
    expect(e.x).toBe(x0);
    // Luego, `chain` embestidas casi seguidas, cada una con su pasillo sin daño.
    expect(lanes(w, e)).toBe(R.chain);
    // Ya no queda nada de la tanda: lo siguiente es volver a llamar a las ratas.
    expect(e.burst).toBe(0);
    expect(w.tele.items.slice(0, w.tele.count).every((t) => t.dmg === 0)).toBe(true);

    const w2 = quiet();
    const b = spawnEnemy(w2, 'rey_rata', w2.player.x + 600, w2.player.y);
    b.hp = b.maxHp * 0.4;
    b.timer = 0;
    run(w2, STEP * 2);
    expect(b.phase).toBe(2);
    expect(b.burst).toBe(R.chainP2);
    expect(lanes(w2, b)).toBe(R.chainP2);
  });
});
