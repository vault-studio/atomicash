import { describe, expect, it } from 'vitest';
import { serviceWorker } from '../tools/pwa';

describe('service worker', () => {
  it('precachea la página y los ficheros, con la versión en el nombre de la caché', () => {
    const sw = serviceWorker('abc123', ['static/index.js', 'assets/tiles/suelo_0.png']);
    expect(sw).toContain("const CACHE = 'atomicash-abc123';");
    const files = JSON.parse(/const FILES = (\[.*\]);/.exec(sw)![1]!) as string[];
    expect(files).toEqual(['./', 'static/index.js', 'assets/tiles/suelo_0.png']);
  });

  it('sirve los módulos aunque el servidor responda Vary: Origin', () => {
    expect(serviceWorker('x', [])).toContain('ignoreVary: true');
  });
});
