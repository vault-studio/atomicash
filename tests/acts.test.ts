// Actos: cada uno tiene su suelo y sus objetos, y el acto solo cambia el aspecto del mapa.
import { describe, expect, it } from 'vitest';
import tiles from '../assets/tiles/tiles.json';
import { ACT_IDS } from '../src/config/acts';
import {
  PROP_BUILDING,
  PROP_LIST,
  PROP_SHAPES,
  PROPS_BY_ACT,
  PROPS_BY_CELLS,
  RUBBLE_PROPS,
} from '../src/config/props';
import { TILES } from '../src/config/render';
import { createCellObject, objectAt } from '../src/engine/obstacles';
import { createWorld, tick } from '../src/engine/world';
import en from '../src/i18n/en.json';
import es from '../src/i18n/es.json';

const sets = tiles.sets as Record<string, readonly { acid?: number }[]>;

describe('actos', () => {
  it('el mundo guarda su acto, y por defecto es el 1', () => {
    expect(createWorld('dot', 1).act).toBe(1);
    expect(createWorld('dot', 1, { act: 3 }).act).toBe(3);
  });

  it('cada acto tiene nombre en los dos idiomas', () => {
    for (const a of ACT_IDS) {
      expect(es.acts[a]).toBeTruthy();
      expect(en.acts[a]).toBeTruthy();
    }
  });

  it('cada acto tiene su lámina de suelo, con 4 baldosas y 2 lagos', () => {
    for (const a of ACT_IDS) {
      const set = sets[TILES.acts[a].sand]!;
      expect(set).toHaveLength(6);
      expect(set.filter((t) => t.acid).length).toBe(2);
    }
  });

  it('cada acto tiene objetos propios de todos los tamaños y los 4 edificios', () => {
    const seen = new Set<number>();
    for (const a of ACT_IDS) {
      const lists = PROPS_BY_ACT[a];
      for (const k of [...lists[1], ...lists[2], ...lists[9]]) {
        expect(seen.has(k)).toBe(false);
        seen.add(k);
        expect(RUBBLE_PROPS).not.toContain(k);
        expect(PROP_SHAPES[k]).toBeDefined();
      }
      expect(lists[1].length).toBeGreaterThan(0);
      expect(lists[2].length).toBeGreaterThan(0);
      expect(lists[9].map((k) => PROP_BUILDING[k]).sort()).toEqual(['necro', 'raiders', 'robots', 'supply']);
    }
  });

  it('el acto 1 no cambia: sus objetos son los que no llevan acto', () => {
    expect(PROPS_BY_ACT[1]).toBe(PROPS_BY_CELLS);
    for (const k of [...PROPS_BY_CELLS[1], ...PROPS_BY_CELLS[2], ...PROPS_BY_CELLS[9]])
      expect(PROP_LIST[k]!.act).toBeUndefined();
  });

  it('una partida en cada acto corre sin problemas, con sus choques y sus edificios', () => {
    for (const act of ACT_IDS) {
      const w = createWorld('dot', 3, { act });
      for (let n = 0; n < 1200; n++) tick(w, { moveX: 1, moveY: 0.4 }, 1 / 60);
      expect(w.time).toBeGreaterThan(0);
    }
  });

  it('el acto cambia qué objeto sale, no dónde', () => {
    const a = createCellObject();
    const b = createCellObject();
    let found = 0;
    for (let j = -60; j < 60; j++)
      for (let i = -60; i < 60; i++) {
        const has = objectAt(7, i, j, 0, 0, a, 1);
        expect(objectAt(7, i, j, 0, 0, b, 2)).toBe(has);
        if (!has) continue;
        found++;
        expect([b.i, b.j, b.x, b.y]).toEqual([a.i, a.j, a.x, a.y]);
        expect(PROP_LIST[b.prop]!.act).toBe(2);
        expect(PROP_LIST[b.prop]!.cells).toBe(PROP_LIST[a.prop]!.cells);
      }
    expect(found).toBeGreaterThan(0);
  });
});
