import { describe, expect, it } from 'vitest';
import { Pool } from '../src/engine/pool';
import { createRng } from '../src/engine/rng';
import { SpatialHash, type Circle } from '../src/engine/spatialHash';

describe('Pool', () => {
  it('reutiliza objetos y libera intercambiando con el último', () => {
    let created = 0;
    const pool = new Pool(() => ({ id: created++ }), 3);
    expect(created).toBe(3);
    const a = pool.acquire();
    const b = pool.acquire();
    const c = pool.acquire();
    pool.releaseAt(0);
    expect(pool.count).toBe(2);
    expect(pool.items.slice(0, 2)).toEqual([c, b]);
    expect(pool.acquire()).toBe(a);
    expect(created).toBe(3);
  });

  it('solo crece cuando se queda sin objetos libres', () => {
    let created = 0;
    const pool = new Pool(() => ({ id: created++ }), 2);
    for (let i = 0; i < 3; i++) pool.acquire();
    expect(created).toBe(3);
    for (let round = 0; round < 100; round++) {
      while (pool.count) pool.releaseAt(pool.count - 1);
      for (let i = 0; i < 3; i++) pool.acquire();
    }
    expect(created).toBe(3);
  });
});

describe('SpatialHash', () => {
  const SIZE = 1000;
  const MAX_R = 18;

  function randomCircles(n: number, seed: number): Circle[] {
    const rng = createRng(seed);
    return Array.from({ length: n }, () => ({
      x: rng() * SIZE,
      y: rng() * SIZE,
      r: 4 + rng() * (MAX_R - 4),
    }));
  }

  function brute(items: Circle[], x: number, y: number, r: number): number[] {
    return items
      .map((c, i) => ((c.x - x) ** 2 + (c.y - y) ** 2 < (r + c.r) ** 2 ? i : -1))
      .filter((i) => i >= 0);
  }

  it('devuelve exactamente los mismos vecinos que la fuerza bruta', () => {
    const items = randomCircles(800, 7);
    const grid = new SpatialHash<Circle>(SIZE, 64, 800);
    grid.build(items, items.length);
    const out = new Int32Array(800);
    const rng = createRng(99);
    for (let q = 0; q < 200; q++) {
      const x = rng() * SIZE;
      const y = rng() * SIZE;
      const r = rng() * 80;
      const k = grid.query(x, y, r, MAX_R, out);
      expect(Array.from(out.subarray(0, k)).sort((a, b) => a - b)).toEqual(brute(items, x, y, r));
    }
  });

  it('encuentra vecinos cuyo centro está en otra celda y entidades fuera del mapa', () => {
    const items: Circle[] = [
      { x: 63, y: 10, r: 10 },
      { x: 70, y: 10, r: 10 },
      { x: -20, y: -20, r: 10 },
      { x: SIZE + 30, y: 500, r: 10 },
    ];
    const grid = new SpatialHash<Circle>(SIZE, 64, 4);
    grid.build(items, items.length);
    const out = new Int32Array(8);
    expect(Array.from(out.subarray(0, grid.query(63, 10, 10, 10, out))).sort()).toEqual([0, 1]);
    expect(Array.from(out.subarray(0, grid.query(-15, -15, 2, 10, out)))).toEqual([2]);
    expect(Array.from(out.subarray(0, grid.query(SIZE + 25, 500, 2, 10, out)))).toEqual([3]);
  });

  it('solo indexa los `count` primeros y respeta el tamaño del buffer de salida', () => {
    const items = Array.from({ length: 10 }, () => ({ x: 100, y: 100, r: 5 }));
    const grid = new SpatialHash<Circle>(SIZE, 64, 10);
    grid.build(items, 6);
    expect(grid.query(100, 100, 1, 5, new Int32Array(10))).toBe(6);
    expect(grid.query(100, 100, 1, 5, new Int32Array(4))).toBe(4);
  });

  it('crece si se supera la capacidad', () => {
    const items = randomCircles(50, 3);
    const grid = new SpatialHash<Circle>(SIZE, 64, 10);
    grid.build(items, items.length);
    expect(grid.capacity).toBeGreaterThanOrEqual(50);
    expect(grid.size).toBe(50);
  });
});
