// Élites: aparición, prefijos y botín.
import { describe, expect, it } from 'vitest';
import { ELITES, ENEMY_STATS } from '../src/config/enemies';
import { FIELD_PICKUP_IDS } from '../src/config/items';
import { RUN } from '../src/config/run';
import { hitEnemy, killEnemy } from '../src/engine/systems/combat';
import { spawnEnemy } from '../src/engine/systems/enemies';
import { spawnElite } from '../src/engine/systems/spawning';
import { type Enemy, type InputState, type World } from '../src/engine/types';
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

describe('élites', () => {
  it('aparecen solos, cada `everyMin`–`everyMax` s', () => {
    const w = quiet();
    const at = 12;
    w.nextElite = at;
    run(w, at + 1);
    expect(alive(w).filter((e) => e.elite)).toHaveLength(1);
    expect(w.nextElite).toBeGreaterThanOrEqual(at + ELITES.everyMin);
    expect(w.nextElite).toBeLessThanOrEqual(at + ELITES.everyMax + 1);
  });

  it('son más duros, sueltan un power-up (y a veces el cofre) y llenan la barra del HUD al golpearlos', () => {
    const w = quiet();
    const e = spawnElite(w);
    expect(e.elite).not.toBeNull();
    expect(e.maxHp).toBeCloseTo(ENEMY_STATS[e.type].hp * (1 + w.time / 250) * ELITES.hp);
    hitEnemy(w, e, 1, 'llave', 4);
    expect(w.eliteFocus).toBe(e.id);
    (w as { rng: () => number }).rng = () => 0; // por debajo de cacheChance: también cofre
    killEnemy(w, e, 'llave');
    const kinds = w.pickups.items.slice(0, w.pickups.count).map((k) => k.kind);
    expect(kinds.filter((k) => (FIELD_PICKUP_IDS as readonly string[]).includes(k)).length).toBeGreaterThan(
      0,
    );
    expect(kinds.filter((k) => k === 'cache')).toHaveLength(1);
  });

  it('el blindado resta su blindaje a cada golpe y el divisor se parte al morir', () => {
    const w = quiet();
    const e = spawnEnemy(w, 'saqueador', w.player.x + 300, w.player.y);
    e.elite = 'blindado';
    expect(hitEnemy(w, e, 10, 'llave', 4)).toBe(10 - ELITES.blindado.armor);
    e.elite = 'divisor';
    killEnemy(w, e, 'llave');
    expect(alive(w).filter((o) => o.type === 'saqueador')).toHaveLength(ELITES.divisor.split);
  });
});
