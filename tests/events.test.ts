// Validación de los JSON del editor de eventos (src/config/events.ts).
import { describe, expect, it } from 'vitest';
import {
  EVENT_SIZE,
  EVENT_VERSION,
  pieceCells,
  validateEvent,
  validateEventNames,
  type EventPiece,
} from '../src/config/events';
import { PROP_LIST } from '../src/config/props';

const idOf = (cells: number): string => {
  const p = PROP_LIST.find((q) => q.cells === cells);
  if (!p) throw new Error(`No hay objetos de ${cells} casillas`);
  return p.file.replace(/\.png$/, '');
};
const ONE = idOf(1);
const LONG = idOf(2);
const BIG = idOf(9);

const piece = (over: Partial<EventPiece> = {}): EventPiece => ({
  type: 'prop',
  id: ONE,
  x: 0,
  y: 0,
  flip: false,
  blocks: true,
  count: 1,
  ...over,
});
const event = (pieces: unknown[] = [piece()], over: Record<string, unknown> = {}) => ({
  version: EVENT_VERSION,
  id: 'prueba_1',
  biome: 2,
  size: EVENT_SIZE,
  pieces,
  ...over,
});
const error = (raw: unknown): string => {
  const r = validateEvent(raw);
  return r.ok ? '' : r.error;
};

describe('validateEvent: casos buenos', () => {
  it('acepta decorado, enemigos y recogibles, y devuelve una copia limpia', () => {
    const raw = event([
      piece(),
      piece({ type: 'enemy', id: 'necrofago', x: 0, y: 0, blocks: false, count: 5 }),
      piece({ type: 'enemy', id: 'coloso', x: 3, y: -2, blocks: false }),
      piece({ type: 'pickup', id: 'chest', x: 1, y: 0, blocks: false }),
      piece({ id: BIG, x: -7, y: -7, flip: true }),
      { ...piece({ id: LONG, x: 6, y: 7 }), sobra: 1 },
    ]);
    const r = validateEvent(raw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.event.pieces).toHaveLength(6);
    expect(r.event.pieces[5]).not.toHaveProperty('sobra');
    expect(JSON.parse(JSON.stringify(r.event))).toEqual(validateEvent(r.event).ok && r.event);
  });

  it('acepta un evento vacío y el bioma «cualquiera»', () => {
    expect(validateEvent(event([], { biome: 'any' })).ok).toBe(true);
  });

  it('acepta todos los tamaños impares de 3 a 15', () => {
    for (const size of [3, 5, 7, 9, 11, 13, 15]) expect(validateEvent(event([], { size })).ok).toBe(true);
    expect(validateEvent(event([piece({ x: 1, y: -1 })], { size: 3 })).ok).toBe(true);
  });

  it('los de 2 casillas giran con el volteo y los edificios ocupan 3×3', () => {
    expect(pieceCells(piece({ id: LONG }))).toEqual([
      [0, 0],
      [1, 0],
    ]);
    expect(pieceCells(piece({ id: LONG, flip: true }))).toEqual([
      [0, 0],
      [0, 1],
    ]);
    expect(pieceCells(piece({ id: BIG, x: 2, y: 3 }))).toHaveLength(9);
    expect(validateEvent(event([piece({ id: LONG, x: 7, flip: true, y: 6 })])).ok).toBe(true);
  });
});

describe('validateEvent: casos malos', () => {
  it('rechaza raíz, versión, id, bioma y tamaño incorrectos', () => {
    expect(error(null)).toMatch(/objeto/);
    expect(error([])).toMatch(/objeto/);
    expect(error(event(undefined, { version: 2 }))).toMatch(/Versión/);
    expect(error(event(undefined, { id: 'Con Espacios' }))).toMatch(/id/);
    expect(error(event(undefined, { id: '' }))).toMatch(/id/);
    expect(error(event(undefined, { biome: 4 }))).toMatch(/Bioma/);
    for (const size of [14, 1, 17, '15', 15.5]) expect(error(event(undefined, { size }))).toMatch(/Tamaño/);
    expect(error(event(undefined, { pieces: 'nada' }))).toMatch(/piezas/);
  });

  it('rechaza piezas mal formadas', () => {
    expect(error(event([42]))).toMatch(/objeto/);
    expect(error(event([piece({ type: 'npc' as never })]))).toMatch(/tipo/);
    expect(error(event([piece({ id: '../x' })]))).toMatch(/id/);
    expect(error(event([piece({ x: 0.5 })]))).toMatch(/entera/);
    expect(error(event([{ ...piece(), flip: 'no' }]))).toMatch(/booleanos/);
    expect(error(event([piece({ type: 'enemy', id: 'dron', blocks: false, count: 0 })]))).toMatch(/cantidad/);
    expect(error(event([piece({ count: 2 })]))).toMatch(/cantidad/);
    expect(error(event([piece({ type: 'pickup', id: 'chest' })]))).toMatch(/bloquean/);
  });

  it('rechaza piezas fuera del mapa, también por su huella', () => {
    expect(error(event([piece({ x: 8 })]))).toMatch(/sale/);
    expect(error(event([piece({ id: LONG, x: 7 })]))).toMatch(/sale/);
    expect(error(event([piece({ id: BIG, x: 6, y: 0 })]))).toMatch(/sale/);
    expect(error(event([piece({ x: 2 })], { size: 3 }))).toMatch(/sale/);
    expect(error(event([piece({ id: BIG, x: 0, y: 0 })], { size: 3 }))).toMatch(/sale/);
    expect(validateEvent(event([piece({ id: BIG, x: -1, y: -1 })], { size: 3 })).ok).toBe(true);
  });

  it('una pieza de decorado o recogible por casilla; un grupo de enemigos por casilla', () => {
    const chest = piece({ type: 'pickup', id: 'chest', blocks: false });
    expect(error(event([piece(), chest]))).toMatch(/ocupada/);
    expect(error(event([piece({ id: BIG, x: -1, y: -1 }), piece({ x: 1, y: 1 })]))).toMatch(/ocupada/);
    const necro = piece({ type: 'enemy', id: 'necrofago', blocks: false });
    expect(error(event([necro, { ...necro, id: 'dron' }]))).toMatch(/ocupada/);
    expect(validateEvent(event([piece(), necro])).ok).toBe(true);
  });
});

describe('validateEventNames', () => {
  it('pide ES y EN no vacíos de hasta 60 caracteres', () => {
    expect(validateEventNames({ es: 'Baile', en: 'Dance' })).toBe(true);
    expect(validateEventNames({ es: 'Baile' })).toBe(false);
    expect(validateEventNames({ es: '  ', en: 'Dance' })).toBe(false);
    expect(validateEventNames({ es: 'x'.repeat(61), en: 'Dance' })).toBe(false);
    expect(validateEventNames('Baile')).toBe(false);
  });
});
