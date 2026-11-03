import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PLAYER } from '../src/config/run';
import { TUNING, applyTuning, resetTuning, tuningDefaults } from '../src/config/tuning';
import { createWorld } from '../src/engine/world';
import {
  applyBuild,
  buildWorldOptions,
  devStatus,
  formatBuild,
  formatStatus,
  getAt,
  makePatch,
  matchesFilter,
  parseBuild,
  parseDevParams,
  parseJsonField,
  parseSeed,
  spawnAround,
  subtreeMatches,
} from '../src/app/debug/devUtils';
import { validateTuningText } from '../tools/devTuning';

describe('parámetros de URL', () => {
  it('sin parámetros: valores por defecto', () => {
    expect(parseDevParams('?dev')).toEqual({
      char: 'dot',
      seed: null,
      build: [],
      god: false,
      speed: 1,
      bot: null,
      panel: true,
    });
  });

  it('lee todos los parámetros', () => {
    const p = parseDevParams('?dev&char=gus&seed=42&weapons=llave:3,tesla:2&god=1&speed=2&bot=kite&panel=0');
    expect(p).toEqual({
      char: 'gus',
      seed: 42,
      build: [
        { id: 'llave', lvl: 3 },
        { id: 'tesla', lvl: 2 },
      ],
      god: true,
      speed: 2,
      bot: 'kite',
      panel: false,
    });
  });

  it('ignora lo inválido y acota la velocidad', () => {
    const p = parseDevParams('?dev&char=mae&seed=abc&bot=volar&speed=99');
    expect(p.char).toBe('dot');
    expect(p.seed).toBeNull();
    expect(p.bot).toBeNull();
    expect(p.speed).toBe(4);
    expect(parseDevParams('?speed=0.01').speed).toBe(0.25);
  });

  it('semilla: entera, vacía o no numérica da null', () => {
    expect(parseSeed('7.9')).toBe(7);
    expect(parseSeed('-3')).toBe(-3);
    expect(parseSeed('')).toBeNull();
    expect(parseSeed(null)).toBeNull();
    expect(parseSeed('x')).toBeNull();
  });
});

describe('build inicial id:nivel', () => {
  it('nivel por defecto 1 y tope en el máximo del juego', () => {
    const { items, ignored } = parseBuild('llave, tesla:99 ,jeringa:0');
    expect(items).toEqual([
      { id: 'llave', lvl: 1 },
      { id: 'tesla', lvl: PLAYER.maxWeaponLevel },
      { id: 'jeringa', lvl: 1 },
    ]);
    expect(ignored).toEqual([]);
  });

  it('descarta ids desconocidos, niveles no numéricos y repetidos', () => {
    const { items, ignored } = parseBuild('llave:2,nada:1,tesla:x,llave:4,');
    expect(items).toEqual([{ id: 'llave', lvl: 2 }]);
    expect(ignored).toEqual(['nada:1', 'tesla:x', 'llave:4']);
  });

  it('formatBuild es la inversa de parseBuild', () => {
    const { items } = parseBuild('tesla:2,llave:3');
    expect(formatBuild(items)).toBe('tesla:2,llave:3');
    expect(parseBuild(formatBuild(items)).items).toEqual(items);
    expect(parseBuild(undefined).items).toEqual([]);
  });

  it('la primera arma sustituye a la inicial y el resto se añade', () => {
    const { items } = parseBuild('tesla:2,llave:3');
    expect(buildWorldOptions(items)).toEqual({ startWeapon: 'tesla' });
    expect(buildWorldOptions([])).toBeUndefined();
    const w = createWorld('dot', 1, { ...buildWorldOptions(items), hazards: false });
    applyBuild(w, items);
    expect(w.weapons.map((x) => `${x.id}:${x.lvl}`)).toEqual(['tesla:2', 'llave:3']);
  });
});

describe('edición de valores por ruta', () => {
  const tree = { a: { b: 1, c: 'x' }, list: [{ n: 1 }, { n: 2 }], flag: true };

  it('getAt recorre objetos y listas', () => {
    expect(getAt(tree, ['a', 'b'])).toBe(1);
    expect(getAt(tree, ['list', 1, 'n'])).toBe(2);
    expect(getAt(tree, ['a', 'zz'])).toBeUndefined();
  });

  it('el parche de un valor suelto solo contiene su ruta', () => {
    expect(makePatch(tree, ['a', 'b'], 5)).toEqual({ a: { b: 5 } });
  });

  it('el parche de un elemento de lista lleva la lista entera y no toca el original', () => {
    const patch = makePatch(tree, ['list', 0, 'n'], 9);
    expect(patch).toEqual({ list: [{ n: 9 }, { n: 2 }] });
    expect(tree.list[0]!.n).toBe(1);
  });

  it('una lista entera se sustituye tal cual', () => {
    expect(makePatch(tree, ['list'], [])).toEqual({ list: [] });
    expect(() => makePatch(tree, ['nope', 'x'], 1)).toThrow();
  });

  it('con applyTuning cambia el valor en sitio; el resto, intacto', () => {
    try {
      const before = tuningDefaults();
      const skipped = applyTuning(makePatch(TUNING, ['enemies', 'dron', 'hp'], 123));
      expect(skipped).toEqual([]);
      expect(TUNING.enemies.dron.hp).toBe(123);
      expect(TUNING.enemies.necrofago).toEqual(before.enemies.necrofago);
      // Un elemento de la lista de oleadas.
      applyTuning(makePatch(TUNING, ['waves', 0, 'rate'], 7));
      expect(TUNING.waves[0]!.rate).toBe(7);
      expect(TUNING.waves).toHaveLength(before.waves.length);
      // Un tipo distinto lo ignora applyTuning y lo avisa.
      expect(applyTuning(makePatch(TUNING, ['enemies', 'dron', 'hp'], 'mucho'))).toEqual(['enemies.dron.hp']);
      expect(TUNING.enemies.dron.hp).toBe(123);
    } finally {
      resetTuning();
    }
  });

  it('el filtro exige todos los términos y poda el árbol', () => {
    expect(matchesFilter(['enemies', 'dron', 'hp'], 'dron hp')).toBe(true);
    expect(matchesFilter(['enemies', 'dron', 'hp'], 'DRON speed')).toBe(false);
    expect(matchesFilter(['x'], '  ')).toBe(true);
    expect(subtreeMatches(tree, [], 'list 1 n')).toBe(true);
    expect(subtreeMatches(tree.a, ['a'], 'flag')).toBe(false);
  });

  it('el campo JSON distingue válido de inválido', () => {
    expect(parseJsonField('{"from":0}')).toEqual({ value: { from: 0 } });
    expect(parseJsonField('"ring"')).toEqual({ value: 'ring' });
    expect(parseJsonField('{from:')).toBeUndefined();
  });
});

describe('acciones sobre el mundo', () => {
  it('spawnAround genera n enemigos del tipo pedido alrededor del jugador', () => {
    const w = createWorld('dot', 3, { hazards: false });
    let k = 0;
    const rand = (): number => ((k++ * 0.37) % 1) + 0.01;
    spawnAround(w, 'dron', 6, rand);
    let n = 0;
    for (let i = 0; i < w.enemies.count; i++) {
      const e = w.enemies.items[i]!;
      if (e.dead || e.type !== 'dron') continue;
      n++;
      const d = Math.hypot(e.x - w.player.x, e.y - w.player.y);
      expect(d).toBeGreaterThanOrEqual(349);
      expect(d).toBeLessThanOrEqual(601);
    }
    expect(n).toBe(6);
    expect(devStatus(w).alive).toBe(6);
  });

  it('formatStatus resume tiempo, nivel, enemigos y vida', () => {
    expect(formatStatus({ time: 125.4, level: 3, alive: 12, hp: 80.4, maxHp: 100 })).toBe(
      '2:05 · nivel 3 · 12 enemigos · PV 80/100',
    );
  });
});

describe('validación del guardado como defaults', () => {
  const ref = { survivors: { dot: { hp: 1 } }, waves: [{ from: 0 }], rage: { after: 1 } };

  it('acepta el mismo conjunto de secciones', () => {
    const r = validateTuningText(JSON.stringify({ ...ref, rage: { after: 9 } }), ref);
    expect(r.ok).toBe(true);
  });

  it('rechaza lo que no es JSON ni objeto', () => {
    expect(validateTuningText('{no', ref)).toEqual({ ok: false, error: 'No es JSON válido' });
    expect(validateTuningText('[1]', ref).ok).toBe(false);
    expect(validateTuningText('null', ref).ok).toBe(false);
  });

  it('rechaza secciones que faltan, sobran o cambian de tipo', () => {
    const sinRage = { survivors: ref.survivors, waves: ref.waves };
    const falta = validateTuningText(JSON.stringify(sinRage), ref);
    expect(falta.ok === false && falta.error).toContain('faltan: rage');
    const sobra = validateTuningText(JSON.stringify({ ...ref, extra: {} }), ref);
    expect(sobra.ok === false && sobra.error).toContain('sobran: extra');
    const tipo = validateTuningText(JSON.stringify({ ...ref, waves: {} }), ref);
    expect(tipo.ok === false && tipo.error).toContain('waves');
  });

  it('el archivo real pasa su propia validación', () => {
    const text = readFileSync('src/data/tuning.json', 'utf8');
    expect(validateTuningText(text, JSON.parse(text)).ok).toBe(true);
  });
});
