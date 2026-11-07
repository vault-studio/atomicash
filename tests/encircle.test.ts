// Cercos (CAMBIOS §4): composición pura y su uso en la horda en anillo.
import { describe, expect, it } from 'vitest';
import { BOSS_IDS, ENEMY_STATS } from '../src/config/enemies';
import { RUN } from '../src/config/run';
import { ACT_IDS } from '../src/config/acts';
import { HORDES } from '../src/config/waves';
import { planRing, widestGap } from '../src/engine/encircle';
import { createRng } from '../src/engine/rng';
import { announceHorde } from '../src/engine/systems/spawning';
import { createWorld, tick } from '../src/engine/world';
describe('cercos', () => {
  it('siempre deja una salida de al menos la anchura pedida', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const n = 10 + (seed % 40);
      const plan = planRing(n, 0.7, 6, [5, 3, 1], [false, false, true], createRng(seed));
      expect(plan.angles).toHaveLength(n);
      expect(widestGap(plan.angles)).toBeGreaterThanOrEqual(0.7 - 1e-9);
    }
  });

  it('combina roles: pesados repartidos y el resto por peso', () => {
    const plan = planRing(24, 0.7, 6, [5, 3, 1], [false, false, true], createRng(3));
    const heavies = plan.slots.filter((s) => s === 2).length;
    expect(heavies).toBe(4);
    expect(new Set(plan.slots).size).toBe(3);
    // Ningún pesado pegado a otro: están repartidos por el anillo.
    for (let i = 1; i < plan.slots.length; i++)
      expect(plan.slots[i] === 2 && plan.slots[i - 1] === 2).toBe(false);
  });

  it('sin pesados en la mezcla, todos salen por peso', () => {
    const plan = planRing(12, 0.6, 6, [1, 1], [false, false], createRng(9));
    expect(plan.slots.every((s) => s === 0 || s === 1)).toBe(true);
  });
});

describe('horda en anillo', () => {
  for (const act of ACT_IDS) {
    it(`en el acto ${act}: varios roles, pesados y una salida libre`, () => {
      const w = createWorld('dot', 7, { startWeapon: null, hazards: false, act });
      w.player.god = true;
      w.nextSpecial = w.nextElite = Infinity;
      for (const k of BOSS_IDS) w.bossSpawned[k] = true;
      // Con todos los roles desbloqueados: el evento especial del segundo 80 del acto.
      w.time = 80;
      announceHorde(w, 'ring');
      const before = w.nextId;
      for (let i = 0; i < Math.ceil((HORDES.warn + 0.1) * RUN.tickHz); i++) {
        w.spawnAcc = -1e9;
        tick(w, { moveX: 0, moveY: 0 }, 1 / RUN.tickHz);
      }
      const p = w.player;
      const ring = w.enemies.items.slice(0, w.enemies.count).filter((e) => e.id >= before);
      expect(ring.length).toBeGreaterThan(5);
      expect(new Set(ring.map((e) => ENEMY_STATS[e.type].role)).size).toBeGreaterThanOrEqual(2);
      expect(ring.some((e) => ENEMY_STATS[e.type].role === 'heavy')).toBe(true);
      const angles = ring.map((e) => Math.atan2(e.y - p.y, e.x - p.x));
      expect(widestGap(angles)).toBeGreaterThanOrEqual(HORDES.ring.gap * 0.9);
    });
  }
});
