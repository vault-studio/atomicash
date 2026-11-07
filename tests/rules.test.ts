import { describe, expect, it } from 'vitest';
import { createRng } from '../src/engine/rng';
import {
  applyArmor,
  hypot2,
  interceptPoint,
  leadLine,
  tickStun,
  tryStun,
  turnToward,
  underCap,
  type StunState,
  type Vec,
} from '../src/engine/rules';

describe('blindaje plano', () => {
  it('resta el blindaje a cada impacto', () => {
    expect(applyArmor(20, 5, 0, 0.1)).toBe(15);
  });
  it('castiga los golpes pequeños y apenas los grandes', () => {
    const small = applyArmor(6, 5, 0, 0.1) / 6;
    const big = applyArmor(60, 5, 0, 0.1) / 60;
    expect(small).toBeLessThan(0.2);
    expect(big).toBeGreaterThan(0.9);
  });
  it('nunca baja del mínimo (nadie es inmune)', () => {
    expect(applyArmor(4, 50, 0, 0.1)).toBeCloseTo(0.4);
  });
  it('la perforación anula blindaje', () => {
    expect(applyArmor(10, 5, 3, 0.1)).toBe(8);
    expect(applyArmor(10, 5, 9, 0.1)).toBe(10);
  });
  it('sin daño no hay daño', () => {
    expect(applyArmor(0, 5, 0, 0.1)).toBe(0);
  });
});

describe('aturdimiento e inmunidad', () => {
  it('aturde y da inmunidad posterior', () => {
    const s: StunState = { stun: 0, stunImmune: 0 };
    expect(tryStun(s, 1, 3)).toBe(true);
    expect(s.stun).toBe(1);
    expect(s.stunImmune).toBe(4);
  });
  it('no se encadena: durante el aturdimiento ni durante la inmunidad', () => {
    const s: StunState = { stun: 0, stunImmune: 0 };
    tryStun(s, 1, 3);
    expect(tryStun(s, 1, 3)).toBe(false);
    tickStun(s, 1);
    expect(s.stun).toBe(0);
    expect(tryStun(s, 1, 3)).toBe(false);
    tickStun(s, 2.99);
    expect(tryStun(s, 1, 3)).toBe(false);
    tickStun(s, 0.02);
    expect(tryStun(s, 1, 3)).toBe(true);
  });
});

describe('límite por tipo', () => {
  it('respeta el tope y 0 = sin límite', () => {
    expect(underCap(1, 2)).toBe(true);
    expect(underCap(2, 2)).toBe(false);
    expect(underCap(99, 0)).toBe(true);
    expect(underCap(99, undefined)).toBe(true);
  });
});

describe('predicción de la posición del jugador', () => {
  const out: Vec = { x: 0, y: 0 };
  it('con el jugador quieto apunta a donde está', () => {
    const t = interceptPoint(0, 0, 100, 0, 0, 0, 200, 3, out);
    expect(t).toBeCloseTo(0.5);
    expect(out).toEqual({ x: 100, y: 0 });
  });
  it('se adelanta a un jugador que cruza', () => {
    // Jugador a 300 px hacia arriba que corre en x a 200 px/s; el perseguidor va a 400 px/s.
    const t = interceptPoint(0, 0, 0, 300, 200, 0, 400, 3, out);
    expect(out.x).toBeGreaterThan(0);
    expect(out.y).toBe(300);
    // Llegan a la vez: la distancia al punto es velocidad × t.
    expect(Math.hypot(out.x, out.y)).toBeCloseTo(400 * t);
  });
  it('si no puede alcanzarlo limita la anticipación', () => {
    const t = interceptPoint(0, 0, 100, 0, 500, 0, 100, 1.5, out);
    expect(t).toBe(1.5);
    expect(out.x).toBeCloseTo(850);
  });
});

describe('giro limitado', () => {
  it('no gira más de lo permitido por paso', () => {
    const out: Vec = { x: 0, y: 0 };
    turnToward(1, 0, 0, 1, 0.1, out);
    expect(Math.atan2(out.y, out.x)).toBeCloseTo(0.1);
    turnToward(1, 0, 1, 0.01, 0.1, out);
    expect(Math.atan2(out.y, out.x)).toBeCloseTo(0.01);
  });
});

describe('salva en línea del tirador especial', () => {
  it('coloca los impactos por delante, en la dirección de movimiento', () => {
    const pts: Vec[] = Array.from({ length: 4 }, () => ({ x: 0, y: 0 }));
    leadLine(10, 20, 0, 5, 100, 50, 3, pts);
    expect(pts.slice(0, 3)).toEqual([
      { x: 10, y: 120 },
      { x: 10, y: 170 },
      { x: 10, y: 220 },
    ]);
    expect(pts[3]).toEqual({ x: 0, y: 0 });
  });

  it('hypot2 da exactamente lo mismo que Math.hypot, bit a bit', () => {
    const rng = createRng(1);
    for (let i = 0; i < 20_000; i++) {
      // Escalas distintas en cada eje: la suma normalizada es donde se nota el último bit.
      const x = (rng() - 0.5) * 10 ** ((rng() * 12 - 6) | 0);
      const y = (rng() - 0.5) * 10 ** ((rng() * 12 - 6) | 0);
      expect(hypot2(x, y)).toBe(Math.hypot(x, y));
    }
    expect(hypot2(0, 0)).toBe(0);
    expect(hypot2(-3, 4)).toBe(5);
    expect(hypot2(Infinity, 1)).toBe(Infinity);
    expect(hypot2(NaN, 1)).toBeNaN();
  });
});
