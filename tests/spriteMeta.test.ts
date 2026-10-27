import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { animDuration, frameIndex, parseSpriteMeta, rowIndex } from '../src/render/spriteMeta';

const contract = {
  id: 'dron',
  anim: 'move',
  cell: [256, 256],
  pivot: [128, 200],
  directions: ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE'],
  frames: 12,
  fps: 16,
  loop: true,
};

describe('parseSpriteMeta', () => {
  it('acepta el JSON del contrato', () => {
    const m = parseSpriteMeta(contract);
    expect(m).toMatchObject({ id: 'dron', anim: 'move', frames: 12, fps: 16, loop: true, pivot: [128, 200] });
    expect(animDuration(m!)).toBeCloseTo(0.75);
  });

  it('lee los JSON reales de assets/sprites', () => {
    for (const path of JSON.parse(readFileSync('assets/manifest.json', 'utf8')) as string[]) {
      const m = parseSpriteMeta(JSON.parse(readFileSync(`assets/sprites/${path}.json`, 'utf8')));
      expect(m, path).not.toBeNull();
      expect(path.endsWith(`${m!.id}_${m!.anim}`)).toBe(true);
    }
  });

  it('rechaza JSON inválidos en vez de fallar', () => {
    expect(parseSpriteMeta(null)).toBeNull();
    expect(parseSpriteMeta({ id: 'x', anim: 'run' })).toBeNull();
    expect(parseSpriteMeta({ ...contract, cell: [0, 256] })).toBeNull();
  });

  it('completa lo que falta con los valores por defecto', () => {
    const m = parseSpriteMeta({ id: 'necrofago', anim: 'death', cell: [512, 512] })!;
    expect(m.frames).toBe(12);
    expect(m.pivot).toEqual([256, 400]);
    expect(m.directions).toHaveLength(8);
    expect(parseSpriteMeta({ id: 'x', anim: 'run', cell: [256, 256] }, 256 * 10)!.frames).toBe(10);
  });

  it('aplica el pivotOverride de la config', () => {
    expect(parseSpriteMeta({ ...contract, id: 'dot', anim: 'run' })!.pivot).toEqual([128, 213]);
  });
});

describe('frameIndex', () => {
  it('cicla las animaciones en bucle', () => {
    const m = parseSpriteMeta(contract)!;
    expect(frameIndex(m, 0)).toBe(0);
    expect(frameIndex(m, 1 / 16)).toBe(1);
    expect(frameIndex(m, 12 / 16)).toBe(0);
  });

  it('death se reproduce una vez y se queda en el último frame aunque el JSON diga loop', () => {
    const m = parseSpriteMeta({ ...contract, anim: 'death', loop: true })!;
    expect(m.loop).toBe(false);
    expect(frameIndex(m, 0.5)).toBe(8);
    expect(frameIndex(m, 10)).toBe(11);
  });
});

describe('rowIndex', () => {
  it('sigue el orden de direcciones del JSON', () => {
    const m = parseSpriteMeta(contract)!;
    for (let d = 0; d < 8; d++) expect(rowIndex(m, d)).toBe(d);
  });

  it('acepta nombres en español y orden distinto', () => {
    const m = parseSpriteMeta({ ...contract, directions: ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'] })!;
    expect(rowIndex(m, 0)).toBe(4); // S
    expect(rowIndex(m, 2)).toBe(6); // W → O
    expect(rowIndex(m, 4)).toBe(0); // N
  });

  it('una hoja de una sola dirección usa siempre la fila 0', () => {
    const m = parseSpriteMeta({ ...contract, directions: ['S'] })!;
    expect(rowIndex(m, 5)).toBe(0);
  });
});
