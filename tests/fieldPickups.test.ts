// Recogibles de campo: botiquín, imán y bomba, que sueltan al azar los enemigos al morir.
import { describe, expect, it } from 'vitest';
import { FIELD_PICKUPS } from '../src/config/items';
import { addPickup, rollFieldPickup } from '../src/engine/systems/combat';
import { spawnEnemy } from '../src/engine/systems/enemies';
import { updatePickups } from '../src/engine/systems/progression';
import type { World } from '../src/engine/types';
import { createWorld } from '../src/engine/world';

function quiet(): World {
  const w = createWorld('dot', 1, { startWeapon: null, hazards: false });
  w.nextEvent = Infinity;
  w.spawnAcc = -1e9;
  return w;
}

/** Deja el recogible justo debajo del jugador y lo recoge. */
function pickUp(w: World, kind: 'medkit' | 'magnet' | 'bomb'): void {
  addPickup(w, kind, w.player.x, w.player.y, FIELD_PICKUPS.r);
  updatePickups(w, 1 / 60);
}

describe('recogibles de campo', () => {
  it('el botiquín es el más frecuente, luego el imán y la bomba la más rara', () => {
    const n: Record<string, number> = { medkit: 0, magnet: 0, bomb: 0 };
    for (let i = 0; i < 1000; i++) n[rollFieldPickup(i / 1000)]!++;
    expect(n.medkit).toBeGreaterThan(n.magnet!);
    expect(n.magnet).toBeGreaterThan(n.bomb!);
    expect(n.bomb).toBeGreaterThan(0);
  });

  it('el botiquín cura una parte de la vida máxima', () => {
    const w = quiet();
    const p = w.player;
    p.hp = p.maxHp * 0.2;
    pickUp(w, 'medkit');
    expect(p.hp).toBeCloseTo(p.maxHp * (0.2 + FIELD_PICKUPS.medkitHeal), 5);
  });

  it('el imán atrae la chatarra de la pantalla, no la de fuera', () => {
    const w = quiet();
    const p = w.player;
    const near = addPickup(w, 'gem', p.x + 300, p.y, 5, 1);
    const far = addPickup(w, 'gem', p.x + 2500, p.y + 2500, 5, 1);
    pickUp(w, 'magnet');
    expect(near.pull).toBe(true);
    expect(far.pull).toBe(false);
  });

  it('la bomba mata a todo lo que se ve y deja vivo lo de fuera', () => {
    const w = quiet();
    const p = w.player;
    for (let i = 0; i < 5; i++) spawnEnemy(w, 'necrofago', p.x + 150 + i * 30, p.y, false);
    const far = spawnEnemy(w, 'necrofago', p.x + 2500, p.y + 2500, false);
    const kills = w.kills;
    pickUp(w, 'bomb');
    expect(w.kills - kills).toBe(5);
    expect(w.enemies.count).toBe(1);
    expect(w.enemies.items[0]).toBe(far);
  });
});

describe('huecos de arma y armas de jefe', () => {
  it('3 armas como mucho: la inicial y dos más', async () => {
    const { weaponOptions } = await import('../src/engine/systems/progression');
    const { createWeapon } = await import('../src/engine/systems/weapons');
    const w = createWorld('dot', 1, { hazards: false });
    w.weapons.push(createWeapon('llave'), createWeapon('geiger'));
    expect(w.weapons.length).toBe(3);
    expect(weaponOptions(w).some((c) => c.kind === 'new')).toBe(false);
  });

  it('el Rey Rata y el Dirigible sueltan un cofre de objeto, no un arma', async () => {
    const { killEnemy } = await import('../src/engine/systems/combat');
    const w = createWorld('dot', 1, { hazards: false });
    const before = w.weapons.length;
    for (const boss of ['rey_rata', 'dirigible'] as const) {
      const e = spawnEnemy(w, boss, w.player.x + 500, w.player.y, false);
      killEnemy(w, e, 'llave');
    }
    expect(w.weapons.length).toBe(before);
    expect(w.pickups.items.slice(0, w.pickups.count).filter((k) => k.kind === 'chest')).toHaveLength(2);
  });
});
