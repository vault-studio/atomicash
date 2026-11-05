import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildCatalog, safeRelPath } from '../tools/galeria/catalog.ts';

let root = '';

function put(rel: string, content: string | Buffer = 'x') {
  const abs = path.join(root, rel);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

const ANIM = {
  id: 'dot',
  anim: 'run',
  cell: [64, 64],
  pivot: [32, 50],
  directions: ['S', 'N'],
  frames: 4,
  fps: 10,
  loop: true,
};

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'galeria-'));
  put('src/data/tuning.json', JSON.stringify({ weapons: { llave: {} } }));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('buildCatalog', () => {
  it('clasifica una animación PNG+JSON', async () => {
    put('assets/sprites/characters/dot/dot_run.png');
    put('assets/sprites/characters/dot/dot_run.json', JSON.stringify(ANIM));
    const cat = await buildCatalog(root);
    expect(cat.items).toHaveLength(1);
    const it = cat.items[0]!;
    expect(it).toMatchObject({ kind: 'animation', section: 'personajes', group: 'dot', name: 'run' });
    expect(it.meta).toMatchObject({ frames: 4 });
    expect(it.sidecars).toContain('assets/sprites/characters/dot/dot_run.json');
    expect(cat.sections.every((s) => !s.auto)).toBe(true);
  });

  it('detecta armas por las claves de tuning.json', async () => {
    put('assets/icons/llave.png');
    put('assets/icons/otra.png');
    put('assets/icons/hud/apron.png');
    const cat = await buildCatalog(root);
    const by = Object.fromEntries(cat.items.map((i) => [i.name, i]));
    expect(by.llave).toMatchObject({ section: 'armas' });
    expect(by.otra).toMatchObject({ section: 'iconos', group: 'otros' });
    expect(by.apron).toMatchObject({ section: 'iconos', group: 'hud' });
    expect(cat.sections.map((s) => s.id)).toEqual(['armas', 'iconos']);
  });

  it('una carpeta nueva bajo assets/ crea una sección automática al final', async () => {
    put('assets/sprites/characters/dot/a.png');
    put('assets/cinematicas/intro/f1.png');
    put('assets/cinematicas/musica.m4a');
    const cat = await buildCatalog(root);
    const last = cat.sections[cat.sections.length - 1]!;
    expect(last).toMatchObject({ title: 'cinematicas', auto: true, count: 2 });
    expect(cat.sections[0]!.auto).toBe(false);
  });

  it('assets/sprites/<categoria nueva>/<id>/ no se pierde', async () => {
    put('assets/sprites/vehiculos/jeep/jeep_run.png');
    const cat = await buildCatalog(root);
    expect(cat.items).toHaveLength(1);
    expect(cat.items[0]).toMatchObject({ group: 'jeep' });
    expect(cat.sections[0]).toMatchObject({ title: 'sprites/vehiculos', auto: true });
  });

  it('ignora ARTE/audio entero, y .py/.md/_preview.gif', async () => {
    put('ARTE/hoja.png');
    put('ARTE/sub/otra.webp');
    put('ARTE/audio/lib/sonido.png');
    put('ARTE/audio/pack.m4a');
    put('ARTE/notas.md');
    put('assets/tools.py');
    put('assets/fx/README.md');
    put('assets/sprites/enemies/dron/dron_preview.gif');
    put('assets/sprites/enemies/dron/dron.ini');
    const cat = await buildCatalog(root);
    expect(cat.items.map((i) => i.path).sort()).toEqual(['ARTE/hoja.png', 'ARTE/sub/otra.webp']);
    expect(cat.sections.map((s) => s.id)).toEqual(['hojas']);
  });

  it('lista modelos 3D de NOVEDADES y tolera carpetas ausentes', async () => {
    put('NOVEDADES/Coloso/c.glb');
    put('NOVEDADES/Coloso/c.png');
    const cat = await buildCatalog(root);
    expect(cat.items).toHaveLength(1);
    expect(cat.items[0]).toMatchObject({ kind: 'model', section: 'modelos', group: 'Coloso' });
  });

  it('asigna sidecars de carpeta y marca tiras de fx', async () => {
    put(
      'assets/fx/fx.json',
      JSON.stringify({
        glow: { file: 'glow.png', frames: 6, w: 10, h: 12 },
        one: { file: 'one.png', frames: 1 },
      }),
    );
    put('assets/fx/glow.png');
    put('assets/fx/one.png');
    put('assets/audio/audio.json', '{}');
    put('assets/audio/CREDITS.md', '#');
    put('assets/audio/sfx/boom_1.m4a');
    put('assets/audio/sfx/boom_2.m4a');
    const cat = await buildCatalog(root);
    const by = Object.fromEntries(cat.items.map((i) => [i.name, i]));
    expect(by.glow).toMatchObject({
      kind: 'strip',
      meta: { frames: 6, w: 10, h: 12 },
      sidecars: ['assets/fx/fx.json'],
    });
    expect(by.one).toMatchObject({ kind: 'image', sidecars: ['assets/fx/fx.json'] });
    expect(by.boom_1).toMatchObject({ kind: 'audio', group: 'sfx', subgroup: 'boom' });
    expect(by.boom_1!.sidecars).toEqual(['assets/audio/audio.json', 'assets/audio/CREDITS.md']);
  });

  it('ordena las secciones fijas y los grupos del mapa', async () => {
    put('assets/props/p.png');
    put('assets/tiles/t.png');
    put('assets/pickups/k.png');
    put('assets/portraits/heads/h.png');
    put('assets/portraits/dot.webp');
    const cat = await buildCatalog(root);
    expect(cat.sections.map((s) => s.id)).toEqual(['retratos', 'mapa']);
    expect(cat.items.map((i) => i.group)).toEqual(['retratos', 'cabezas', 'suelos', 'decorado', 'objetos']);
  });
});

describe('safeRelPath', () => {
  it('acepta rutas bajo las raíces permitidas', () => {
    expect(safeRelPath('assets/fx/glow.png')).toBe('assets/fx/glow.png');
    expect(safeRelPath('ARTE/a%20b.png')).toBe('ARTE/a b.png');
    expect(safeRelPath('NOVEDADES/x.glb')).toBe('NOVEDADES/x.glb');
  });

  it('rechaza escapes, absolutas y rutas fuera de las raíces', () => {
    for (const bad of [
      'assets/../package.json',
      '../package.json',
      'assets/%2e%2e/package.json',
      'assets/%2E%2E%2Fpackage.json',
      'assets/..%2fsrc/x',
      '/etc/passwd',
      '%2Fetc/passwd',
      'C:/Windows/win.ini',
      'assets\\..\\x',
      'src/data/tuning.json',
      'node_modules/fflate/package.json',
      'assets',
      'assets//x.png',
      'assets/%00.png',
      'assets/%zz',
    ]) {
      expect(safeRelPath(bad), bad).toBeNull();
    }
  });
});
