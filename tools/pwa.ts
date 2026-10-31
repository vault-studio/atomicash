// PWA sin dependencias (F3-09): emite `manifest.webmanifest`, los iconos y un service worker que precachea
// todo el build (JS, CSS, fuentes, sprites, baldosas) para que el juego funcione sin conexión.
// DECISIÓN: no se usa vite-plugin-pwa/workbox; el juego es una sola página y la lista de ficheros se conoce
// al final del build, así que basta con ~40 líneas de service worker.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';

const ICONS = ['icon-192.png', 'icon-512.png', 'icon-maskable.png', 'apple-touch-icon.png'];

const MANIFEST = {
  name: 'Atomic Ash',
  short_name: 'Atomic Ash',
  description: 'Sobrevive al páramo atómico de los años 50.',
  lang: 'es',
  start_url: './',
  scope: './',
  display: 'fullscreen',
  orientation: 'landscape',
  background_color: '#0b140d',
  theme_color: '#0b140d',
  icons: [
    { src: 'app/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'app/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'app/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};

/**
 * Service worker: precache por versión, caché primero y la página como respaldo de navegación. La música no se
 * precachea (18 MB que todo jugador nuevo bajaría de golpe): se guarda la primera vez que suena. Las peticiones
 * parciales (Range, de los <audio>) van siempre a la red: la caché devolvería un 200 entero y Safari lo rechaza.
 */
export function serviceWorker(version: string, files: readonly string[]): string {
  return `// Generado por tools/pwa.ts. No editar.
const CACHE = 'atomicash-${version}';
const FILES = ${JSON.stringify(['./', ...files])};
const RUNTIME = '/assets/audio/music/';
// La música guardada al sonar va en su propia caché, que sobrevive a las versiones nuevas.
const MUSIC = 'atomicash-music-v1';
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('atomicash-') && k !== CACHE && k !== MUSIC).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('./')));
    return;
  }
  if (req.headers.has('range')) return;
  // ignoreVary: los módulos con crossorigin llevan Origin y el servidor puede responder Vary: Origin.
  e.respondWith(
    caches.match(req, { ignoreVary: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && new URL(req.url).pathname.includes(RUNTIME)) {
            const copy = res.clone();
            caches.open(MUSIC).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
`;
}

export function pwa(): Plugin {
  return {
    name: 'atomicash-pwa',
    enforce: 'post',
    // En dev se sirven el manifiesto y los iconos; el service worker solo existe en el build.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        if (url === '/manifest.webmanifest') {
          res.setHeader('Content-Type', 'application/manifest+json');
          res.end(JSON.stringify(MANIFEST));
        } else if (url.startsWith('/app/') && ICONS.includes(url.slice(5))) {
          res.setHeader('Content-Type', 'image/png');
          res.end(readFileSync(`assets/app/${url.slice(5)}`));
        } else next();
      });
    },
    generateBundle(_opts, bundle) {
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.webmanifest',
        source: JSON.stringify(MANIFEST, null, 2),
      });
      for (const f of ICONS)
        this.emitFile({ type: 'asset', fileName: `app/${f}`, source: readFileSync(`assets/app/${f}`) });
      // Todo lo emitido hasta aquí (incluidos sprites y baldosas de artAssets) entra en el precache.
      // Sin duplicados: `cache.addAll` falla si se repite una URL.
      const files = [
        ...new Set([
          ...Object.keys(bundle).filter((f) => !f.endsWith('.map') && f !== 'index.html'),
          ...ICONS.map((f) => `app/${f}`),
          'manifest.webmanifest',
        ]),
      ]
        .filter((f) => !f.startsWith('assets/audio/music/'))
        .sort();
      // La versión depende del contenido, no solo de los nombres: rehacer el audio con los mismos nombres también
      // tiene que llegar a las PWA instaladas.
      const hash = createHash('sha256').update(files.join('\n'));
      for (const f of Object.keys(bundle).sort()) {
        const out = bundle[f]!;
        hash.update(out.type === 'chunk' ? out.code : out.source);
      }
      const version = hash.digest('hex').slice(0, 12);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: serviceWorker(version, files) });
    },
  };
}
