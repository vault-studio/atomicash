// Servidor local de la Galería de assets. Solo node:http, sin dependencias.
// Ejecutar con: npm run galeria  (Node 24 ejecuta TypeScript directamente).
import { spawn } from 'node:child_process';
import { createReadStream, promises as fs, watch } from 'node:fs';
import type { FSWatcher, Stats } from 'node:fs';
import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { buildCatalog, safeRelPath } from './catalog.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const PUBLIC = path.join(ROOT, 'tools/galeria/public');
const FFLATE = path.join(ROOT, 'node_modules/fflate/esm/browser.js');
const PORT = Number(process.env.PORT) || 5180;
const HOST = '127.0.0.1';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.md': 'text/plain; charset=utf-8',
};

function send(res: ServerResponse, status: number, body: string, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

function etagOf(st: Stats): string {
  return `"${Math.floor(st.mtimeMs).toString(16)}-${st.size.toString(16)}"`;
}

/** Sirve un archivo con ETag (mtime+tamaño), no-cache y soporte de Range. */
async function serveFile(req: IncomingMessage, res: ServerResponse, abs: string): Promise<void> {
  let st: Stats;
  try {
    st = await fs.stat(abs);
  } catch {
    return send(res, 404, 'No encontrado');
  }
  if (!st.isFile()) return send(res, 404, 'No encontrado');
  const etag = etagOf(st);
  const headers: Record<string, string | number> = {
    'Content-Type': MIME[path.extname(abs).toLowerCase()] ?? 'application/octet-stream',
    'Cache-Control': 'no-cache',
    ETag: etag,
    'Last-Modified': st.mtime.toUTCString(),
    'Accept-Ranges': 'bytes',
  };
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, headers);
    res.end();
    return;
  }
  let start = 0;
  let end = st.size - 1;
  let status = 200;
  const range = req.headers.range;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (m) {
      const [, a = '', b = ''] = m;
      if (a === '' && b === '') {
        // sin rango válido: se ignora
      } else {
        if (a === '') {
          start = Math.max(0, st.size - Number(b));
        } else {
          start = Number(a);
          if (b !== '') end = Math.min(end, Number(b));
        }
        if (start > end || start >= st.size) {
          res.writeHead(416, { 'Content-Range': `bytes */${st.size}` });
          res.end();
          return;
        }
        status = 206;
        headers['Content-Range'] = `bytes ${start}-${end}/${st.size}`;
      }
    }
  }
  headers['Content-Length'] = st.size === 0 ? 0 : end - start + 1;
  res.writeHead(status, headers);
  if (req.method === 'HEAD' || st.size === 0) {
    res.end();
    return;
  }
  const stream = createReadStream(abs, { start, end });
  stream.on('error', () => res.destroy());
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}

// --- Cambios en disco → SSE -------------------------------------------------------------------
const clients = new Set<ServerResponse>();
let timer: NodeJS.Timeout | undefined;

function notifyChanged() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    for (const c of clients) c.write('event: changed\ndata: {}\n\n');
  }, 300);
}

const watchers: FSWatcher[] = [];
function startWatchers() {
  const add = (dir: string, recursive: boolean, filter?: (name: string) => boolean) => {
    try {
      const w = watch(dir, { recursive }, (_ev, name) => {
        const n = (name ?? '').toString().replaceAll('\\', '/');
        if (filter && !filter(n)) return;
        notifyChanged();
      });
      w.on('error', () => {});
      watchers.push(w);
    } catch {
      // la carpeta no existe o el sistema no admite el modo recursivo: se ignora
    }
  };
  add(path.join(ROOT, 'assets'), true);
  add(path.join(ROOT, 'ARTE'), true, (n) => !/^audio(\/|$)/i.test(n));
  add(path.join(ROOT, 'NOVEDADES'), true);
  add(path.join(ROOT, 'src/data'), false, (n) => n === 'tuning.json');
}

// --- Rutas --------------------------------------------------------------------------------------
async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Método no permitido');
  const url = req.url ?? '/';
  const q = url.indexOf('?');
  const pathname = q < 0 ? url : url.slice(0, q);

  if (pathname === '/api/catalog') {
    try {
      return send(res, 200, JSON.stringify(await buildCatalog(ROOT)), 'application/json; charset=utf-8');
    } catch (e) {
      return send(res, 500, JSON.stringify({ error: String(e) }), 'application/json; charset=utf-8');
    }
  }

  if (pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('retry: 2000\n\n');
    clients.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 25000);
    res.on('close', () => {
      clearInterval(ping);
      clients.delete(res);
    });
    return;
  }

  if (pathname.startsWith('/files/')) {
    const rel = safeRelPath(pathname.slice('/files/'.length));
    if (!rel) return send(res, 403, 'Prohibido');
    return serveFile(req, res, path.join(ROOT, ...rel.split('/')));
  }

  if (pathname === '/vendor/fflate.js') return serveFile(req, res, FFLATE);

  // Estáticos de public/
  let rel: string;
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    return send(res, 400, 'Petición inválida');
  }
  if (rel === '/') rel = '/index.html';
  const abs = path.resolve(PUBLIC, '.' + rel);
  if (abs !== PUBLIC && !abs.startsWith(PUBLIC + path.sep)) return send(res, 403, 'Prohibido');
  return serveFile(req, res, abs);
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => {
    if (!res.headersSent) send(res, 500, String(e));
    else res.destroy();
  });
});

server.on('error', (e: NodeJS.ErrnoException) => {
  console.error(e.code === 'EADDRINUSE' ? `El puerto ${PORT} está ocupado (usa PORT=...)` : e);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}/`;
  console.log(`Galería de assets en ${url}`);
  startWatchers();
  if (process.argv.includes('--open')) {
    const [cmd, args]: [string, string[]] =
      process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '', url]]
        : process.platform === 'darwin'
          ? ['open', [url]]
          : ['xdg-open', [url]];
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
    child.on('error', () => {});
    child.unref();
  }
});

function shutdown() {
  for (const w of watchers) w.close();
  for (const c of clients) c.end();
  server.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
