import { describe, expect, it } from 'vitest';
import { dirIndex, isoX, isoY, screenToWorldDir } from '../src/render/iso';

// Fila esperada para cada dirección de pantalla (x a la derecha, y hacia abajo).
const SCREEN: [string, number, number, number][] = [
  ['S', 0, 1, 0],
  ['SW', -1, 1, 1],
  ['W', -1, 0, 2],
  ['NW', -1, -1, 3],
  ['N', 0, -1, 4],
  ['NE', 1, -1, 5],
  ['E', 1, 0, 6],
  ['SE', 1, 1, 7],
];

describe('proyección isométrica', () => {
  it('screenToWorldDir es la inversa de la proyección (en dirección)', () => {
    for (const [name, sx, sy] of SCREEN) {
      const w = screenToWorldDir(sx, sy);
      const px = isoX(w.x, w.y);
      const py = isoY(w.x, w.y);
      const l = Math.hypot(px, py);
      const e = Math.hypot(sx, sy);
      expect(px / l, name).toBeCloseTo(sx / e);
      expect(py / l, name).toBeCloseTo(sy / e);
    }
  });

  it('conserva la magnitud de la entrada (≤ 1)', () => {
    expect(Math.hypot(...Object.values(screenToWorldDir(0.5, 0)))).toBeCloseTo(0.5);
    expect(Math.hypot(...Object.values(screenToWorldDir(3, 4)))).toBeCloseTo(1);
    expect(screenToWorldDir(0, 0)).toEqual({ x: 0, y: 0 });
  });

  it('elige la fila del sprite en 8 sectores de 45° (S, SW, W, NW, N, NE, E, SE)', () => {
    for (const [name, sx, sy, row] of SCREEN) {
      const w = screenToWorldDir(sx, sy);
      expect(dirIndex(w.x, w.y), name).toBe(row);
    }
  });

  it('los bordes de sector caen en la fila más cercana', () => {
    const a = (deg: number) => {
      const r = (deg * Math.PI) / 180;
      const w = screenToWorldDir(Math.cos(r), Math.sin(r));
      return dirIndex(w.x, w.y);
    };
    expect(a(90 + 20)).toBe(0); // casi abajo → S
    expect(a(90 + 25)).toBe(1); // pasado 22,5° → SW
    expect(dirIndex(0, 0)).toBe(0);
  });
});
