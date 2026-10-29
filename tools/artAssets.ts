// Plugin de Vite para la carpeta de arte `assets/` (contrato de la biblia de arte §3–§4).
// - Genera `assets/manifest.json` con todas las hojas que tienen PNG + JSON.
// - En dev lo regenera al añadir o quitar hojas; Vite ya sirve `assets/` desde la raíz.
// - En build publica solo lo que consume el juego: manifest, sprites, iconos, baldosas, objetos del suelo y del mapa.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Plugin } from 'vite';

const ASSETS_DIR = 'assets';
const SPRITES_DIR = join(ASSETS_DIR, 'sprites');
const ICONS_DIR = join(ASSETS_DIR, 'icons');
const TILES_DIR = join(ASSETS_DIR, 'tiles');
const PROPS_DIR = join(ASSETS_DIR, 'props');
const PICKUPS_DIR = join(ASSETS_DIR, 'pickups');
const MANIFEST = join(ASSETS_DIR, 'manifest.json');

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const toPosix = (p: string): string => p.replace(/\\/g, '/');

/** Rutas relativas a `assets/sprites`, sin extensión, de las hojas con PNG y JSON. */
export function listSheets(spritesDir = SPRITES_DIR): string[] {
  return walk(spritesDir)
    .filter((p) => p.endsWith('.json') && existsSync(p.replace(/\.json$/, '.png')))
    .map((p) => toPosix(relative(spritesDir, p)).replace(/\.json$/, ''))
    .sort();
}

function writeManifest(): string {
  const text = JSON.stringify(listSheets(), null, 2);
  const current = existsSync(MANIFEST) ? readFileSync(MANIFEST, 'utf8') : '';
  if (current !== text) writeFileSync(MANIFEST, text);
  return text;
}

export function artAssets(): Plugin {
  return {
    name: 'atomicash-art-assets',
    buildStart() {
      writeManifest();
    },
    configureServer(server) {
      writeManifest();
      server.watcher.add(SPRITES_DIR);
      const onChange = (file: string): void => {
        if (toPosix(file).includes('/sprites/') && /\.(json|png)$/i.test(file)) writeManifest();
      };
      server.watcher.on('add', onChange);
      server.watcher.on('unlink', onChange);
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'assets/manifest.json', source: writeManifest() });
      for (const file of [
        ...walk(SPRITES_DIR),
        ...walk(ICONS_DIR),
        ...walk(TILES_DIR),
        ...walk(PROPS_DIR),
        ...walk(PICKUPS_DIR),
      ]) {
        if (!/\.(json|png)$/i.test(file)) continue;
        this.emitFile({ type: 'asset', fileName: toPosix(file), source: readFileSync(file) });
      }
    },
  };
}
