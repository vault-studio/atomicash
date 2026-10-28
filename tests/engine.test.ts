import { describe, expect, it } from 'vitest';
import { RUN } from '../src/config/run';
import { SURVIVORS } from '../src/config/survivors';
import { advance, createFixedStep } from '../src/engine/loop';
import { createRng } from '../src/engine/rng';
import { createWorld, killPlayer, tick } from '../src/engine/world';

describe('paso fijo', () => {
  it('ejecuta un paso por cada 1/60 s acumulado y devuelve el alpha restante', () => {
    const fs = createFixedStep(60, 5);
    let n = 0;
    let alpha = advance(fs, 0.01, () => n++);
    expect(n).toBe(0);
    expect(alpha).toBeCloseTo(0.6);
    alpha = advance(fs, 0.03, () => n++);
    expect(n).toBe(2);
    expect(alpha).toBeCloseTo(0.4);
  });

  it('no entra en espiral tras un parón largo', () => {
    const fs = createFixedStep(60, 5);
    let n = 0;
    const alpha = advance(fs, 2, () => n++);
    expect(n).toBe(5);
    expect(alpha).toBeGreaterThanOrEqual(0);
    expect(alpha).toBeLessThan(1);
  });
});

describe('rng', () => {
  it('es determinista con la misma semilla', () => {
    const a = createRng(42);
    const b = createRng(42);
    const xs = Array.from({ length: 5 }, a);
    expect(Array.from({ length: 5 }, b)).toEqual(xs);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });
});

describe('world', () => {
  const step = 1 / RUN.tickHz;

  it('mueve al jugador a su velocidad y recuerda la orientación', () => {
    const w = createWorld('dot', 1);
    const x0 = w.player.x;
    for (let i = 0; i < RUN.tickHz; i++) tick(w, { moveX: 1, moveY: 0 }, step);
    expect(w.player.x - x0).toBeCloseTo(SURVIVORS.dot.speed);
    expect(w.time).toBeCloseTo(1);
    tick(w, { moveX: 0, moveY: 0 }, step);
    expect(w.player.moving).toBe(false);
    expect([w.player.facingX, w.player.facingY]).toEqual([1, 0]);
  });

  it('el mapa no tiene bordes: se puede andar más allá de cualquier lado', () => {
    const w = createWorld('errante', 1);
    for (let i = 0; i < RUN.tickHz * 30; i++) tick(w, { moveX: -1, moveY: -1 }, step);
    expect(w.player.x).toBeLessThan(0);
    expect(w.player.y).toBeLessThan(0);
    // Y sigue habiendo charcos alrededor, aunque esté lejos del inicio.
    expect(w.hazards.length).toBeGreaterThan(0);
    for (const h of w.hazards) expect(Math.hypot(h.x - w.player.x, h.y - w.player.y)).toBeLessThan(2500);
  });

  it('un jugador muerto no se mueve y guarda el instante de muerte', () => {
    const w = createWorld('mae', 1);
    tick(w, { moveX: 0, moveY: 0 }, step);
    killPlayer(w);
    const { x, deadAt } = w.player;
    expect(deadAt).toBeCloseTo(step);
    tick(w, { moveX: 1, moveY: 0 }, step);
    expect(w.player.x).toBe(x);
    killPlayer(w);
    expect(w.player.deadAt).toBe(deadAt);
  });
});
