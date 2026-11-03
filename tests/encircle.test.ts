import { describe, expect, it } from 'vitest';
import { planRing, widestGap } from '../src/engine/encircle';
import { createRng } from '../src/engine/rng';

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
