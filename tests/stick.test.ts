import { describe, expect, it } from 'vitest';
import { JOYSTICK } from '../src/config/input';
import { stickVector } from '../src/input/stick';

const { radius: R, deadzone: D } = JOYSTICK;

describe('stickVector', () => {
  it('sin arrastre no hay movimiento', () => {
    expect(stickVector(0, 0, R, D)).toEqual({ x: 0, y: 0, knobX: 0, knobY: 0 });
  });

  it('dentro de la zona muerta no mueve, pero el pomo sigue al dedo', () => {
    const v = stickVector(D - 1, 0, R, D);
    expect([v.x, v.y]).toEqual([0, 0]);
    expect(v.knobX).toBe(D - 1);
  });

  it('es analógico: la magnitud crece sin salto desde la zona muerta hasta el radio', () => {
    expect(stickVector(D + 0.001, 0, R, D).x).toBeCloseTo(0, 2);
    expect(stickVector((R + D) / 2, 0, R, D).x).toBeCloseTo(0.5);
    expect(stickVector(R, 0, R, D).x).toBeCloseTo(1);
  });

  it('satura en 1 y limita el pomo al radio fuera del círculo', () => {
    const v = stickVector(0, -3 * R, R, D);
    expect(v.y).toBeCloseTo(-1);
    expect(v.x).toBeCloseTo(0);
    expect(v.knobY).toBeCloseTo(-R);
  });

  it('conserva la dirección en diagonal', () => {
    const v = stickVector(100, 100, R, D);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1);
    expect(v.x).toBeCloseTo(v.y);
  });
});
