// Quemaduras del cóctel: se cogen al pisar el charco o por cada segundo dentro, hasta 3, y queman cada segundo.
import { describe, expect, it } from 'vitest';
import { RUN } from '../src/config/run';
import { WEAPONS } from '../src/config/weapons';
import { spawnEnemy } from '../src/engine/systems/enemies';
import { createWeapon } from '../src/engine/systems/weapons';
import type { Enemy, World } from '../src/engine/types';
import { createWorld, tick } from '../src/engine/world';

const STEP = 1 / RUN.tickHz;
const B = WEAPONS.coctel.burn;

function quiet(): World {
  const w = createWorld('dot', 1, { startWeapon: null, hazards: false });
  w.nextEvent = Infinity;
  w.nextElite = Infinity;
  w.nextHorde = Infinity;
  w.spawnAcc = -1e9;
  w.player.god = true;
  for (const k of ['rey_rata', 'dirigible', 'coloso']) w.bossSpawned[k] = true;
  return w;
}

const run = (w: World, sec: number): void => {
  for (let i = 0; i < Math.round(sec * RUN.tickHz); i++) tick(w, { moveX: 0, moveY: 0 }, STEP);
};

/** Charco de cóctel que solo quema (sin el daño directo del charco). */
function firePool(w: World, x: number, y: number, life: number): void {
  const pl = w.pools.acquire();
  pl.x = x;
  pl.y = y;
  pl.r = 50;
  pl.life = pl.max = life;
  pl.tick = 1e9;
  pl.tickCd = 1e9;
  pl.dmg = 0;
  pl.burn = 10;
  pl.src = 'coctel';
}

/** Enemigo quieto y duro, lejos del jugador. */
function dummy(w: World, dx: number): Enemy {
  const e = spawnEnemy(w, 'necrofago', w.player.x + dx, w.player.y, false);
  e.speed = 0;
  e.hp = e.maxHp = 1e6;
  return e;
}

const stacks = (e: Enemy): number => Array.from(e.burnT).filter((t) => t > 0).length;

describe('quemaduras del cóctel', () => {
  it('pisar el charco da una; cada segundo dentro, otra, hasta 3', () => {
    const w = quiet();
    const e = dummy(w, 400);
    firePool(w, e.x, e.y, 10);
    run(w, 0.1);
    expect(stacks(e)).toBe(1);
    run(w, 1);
    expect(stacks(e)).toBe(2);
    run(w, 1);
    expect(stacks(e)).toBe(B.stacks);
    run(w, 2);
    expect(stacks(e)).toBe(B.stacks);
  });

  it('cruzarlo un instante basta, y quema cada segundo durante la quemadura', () => {
    const w = quiet();
    const e = dummy(w, 400);
    firePool(w, e.x, e.y, STEP * 1.5);
    run(w, 0.1);
    expect(stacks(e)).toBe(1);
    const hp0 = e.hp;
    run(w, B.dur + 1);
    expect(stacks(e)).toBe(0);
    // Un golpe por segundo de la quemadura (sin multiplicadores: daño entre 1 y 1,5 veces el base por golpe).
    const lost = hp0 - e.hp;
    expect(lost).toBeGreaterThanOrEqual(10 * Math.floor(B.dur));
    expect(lost).toBeLessThan(10 * Math.floor(B.dur) * 1.6);
  });

  it('el cóctel cae un poco por delante del bicho, hacia el jugador', () => {
    const w = quiet();
    const e = dummy(w, 300);
    w.weapons = [createWeapon('coctel', 1)];
    run(w, 0.4);
    const l = w.lobs.items[0]!;
    expect(w.lobs.count).toBe(1);
    expect(Math.hypot(l.tx - e.x, l.ty - e.y)).toBeCloseTo(WEAPONS.coctel.lead, 0);
    expect(Math.hypot(l.tx - w.player.x, l.ty - w.player.y)).toBeCloseTo(300 - WEAPONS.coctel.lead, 0);
  });

  it('el cóctel sigue haciendo su daño al caer y su charco quema', () => {
    const w = quiet();
    const e = dummy(w, 300);
    const l = w.lobs.acquire();
    l.sx = w.player.x;
    l.sy = w.player.y;
    l.tx = e.x;
    l.ty = e.y;
    l.t = 0;
    l.dur = 0;
    l.lvl = 1;
    const hp0 = e.hp;
    run(w, 0.05);
    expect(e.hp).toBeLessThan(hp0);
    expect(stacks(e)).toBe(1);
    expect(w.pools.items[0]!.max).toBe(WEAPONS.coctel.dur);
  });
});
