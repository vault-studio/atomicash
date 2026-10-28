// Criterio de F1-05: los enemigos aparecen fuera de cámara según el minuto.
import { describe, expect, it } from 'vitest';
import { RUN } from '../src/config/run';
import { SPAWN, WAVES } from '../src/config/waves';
import { currentWave, currentWaveIndex, placeOffscreen } from '../src/engine/systems/spawning';
import type { Enemy, InputState, World } from '../src/engine/types';
import { isOnScreen, setView } from '../src/engine/view';
import { createWorld, tick } from '../src/engine/world';

/** Sin armas, daño ni eventos (el enjambre aparece a la vista a propósito): solo las oleadas. */
function passive(seed: number): ReturnType<typeof createWorld> {
  const w = createWorld('dot', seed, { startWeapon: null, hazards: false });
  w.player.god = true;
  w.nextEvent = Infinity;
  return w;
}

const STEP = 1 / RUN.tickHz;
const STILL: InputState = { moveX: 0, moveY: 0 };

/** Corre `seconds` de run y devuelve los enemigos nuevos de cada tick, con su posición al aparecer. */
function runCollecting(w: World, seconds: number, input = STILL) {
  const spawned: { type: string; x: number; y: number; t: number; onScreen: boolean; inMap: boolean }[] = [];
  let lastId = w.nextId;
  const ticks = Math.round(seconds * RUN.tickHz);
  for (let i = 0; i < ticks; i++) {
    tick(w, input, STEP);
    for (let k = 0; k < w.enemies.count; k++) {
      const e = w.enemies.items[k] as Enemy;
      // Posición en el tick de aparición (antes de que la IA lo mueva se guardó en prev).
      if (e.id >= lastId) {
        spawned.push({
          type: e.type,
          x: e.prevX,
          y: e.prevY,
          t: w.time,
          onScreen: isOnScreen(w, e.prevX, e.prevY),
          inMap: e.prevX >= 0 && e.prevX <= w.mapSize && e.prevY >= 0 && e.prevY <= w.mapSize,
        });
      }
    }
    lastId = w.nextId;
  }
  return spawned;
}

describe('oleadas', () => {
  it('elige la oleada vigente por tiempo', () => {
    expect(currentWave(0)).toBe(WAVES[0]);
    expect(currentWave(59.9)).toBe(WAVES[0]);
    expect(currentWave(60)).toBe(WAVES[1]);
    expect(currentWaveIndex(899)).toBe(WAVES.length - 1);
  });

  it('respeta el ritmo de la primera oleada', () => {
    const w = passive(1);
    runCollecting(w, 10);
    expect(w.enemies.count).toBe(Math.floor(WAVES[0]!.rate * SPAWN.rateMult * 10));
  });

  it('no supera el máximo de vivos de la oleada', () => {
    const w = passive(1);
    runCollecting(w, 59);
    expect(w.enemies.count).toBeLessThanOrEqual(WAVES[0]!.max);
    expect(w.enemies.count).toBe(WAVES[0]!.max);
  });

  it('solo aparecen tipos de la oleada vigente', () => {
    const w = createWorld('dot', 7, { hazards: false });
    const first = runCollecting(w, 59);
    expect(new Set(first.map((s) => s.type))).toEqual(new Set(Object.keys(WAVES[0]!.mix)));

    // Saltamos al minuto 4: la oleada de 240 s incluye tiradores e hinchados.
    const w2 = createWorld('dot', 7, { hazards: false });
    w2.time = 240;
    w2.bossSpawned.rey_rata = true;
    const later = runCollecting(w2, 30);
    const allowed = new Set(Object.keys(WAVES[4]!.mix));
    expect(later.length).toBeGreaterThan(0);
    for (const s of later) expect(allowed.has(s.type), s.type).toBe(true);
  });

  it('es determinista con la misma semilla', () => {
    const a = runCollecting(createWorld('mae', 42), 20);
    const b = runCollecting(createWorld('mae', 42), 20);
    expect(a).toEqual(b);
  });
});

describe('aparición fuera de cámara', () => {
  it('nunca aparece un enemigo dentro de la cámara, ni moviéndose', () => {
    const w = passive(3);
    const spawned = runCollecting(w, 120, { moveX: 0.6, moveY: -0.8 });
    // Sin armas nadie muere: el tope de vivos de las dos primeras oleadas (40 y 70) limita las apariciones.
    expect(spawned.length).toBe(WAVES[1]!.max);
    expect(spawned.filter((s) => s.onScreen)).toEqual([]);
  });

  it('se adapta a una cámara grande (monitor ancho)', () => {
    const w = passive(3);
    setView(w, 1400, 800);
    const spawned = runCollecting(w, 30);
    expect(spawned.length).toBeGreaterThan(20);
    expect(spawned.filter((s) => s.onScreen)).toEqual([]);
    // A 1400 de semiancho, la distancia mínima ya no basta: debe alejarse más.
    const far = spawned.every((s) => Math.hypot(s.x - w.player.x, s.y - w.player.y) > SPAWN.minDist);
    expect(far).toBe(true);
  });

  it('lejos del inicio (sin bordes) siempre aparece fuera de cámara', () => {
    const w = passive(5);
    w.player.x = w.player.prevX = -5000;
    w.player.y = w.player.prevY = -5000;
    const out = { x: 0, y: 0 };
    for (let i = 0; i < 500; i++) {
      placeOffscreen(w, out);
      expect(isOnScreen(w, out.x, out.y)).toBe(false);
    }
  });

  it('los enemigos que se quedan muy atrás reaparecen delante, fuera de cámara', () => {
    const w = passive(9);
    runCollecting(w, 5);
    const e = w.enemies.items[0] as Enemy;
    e.x = e.prevX = w.player.x + SPAWN.relocateDist + 200;
    e.y = e.prevY = w.player.y;
    tick(w, STILL, STEP);
    const d = Math.hypot(e.x - w.player.x, e.y - w.player.y);
    expect(d).toBeLessThan(SPAWN.relocateDist);
    expect(isOnScreen(w, e.prevX, e.prevY)).toBe(false);
  });
});
