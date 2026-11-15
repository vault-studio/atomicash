// Plugin de Vite solo para el servidor de desarrollo: el editor de eventos (editor.html, src/editor/) lista y guarda
// eventos especiales en `src/data/events/<id>.json`, con su nombre visible en `src/i18n/{es,en}.json` → `events.<id>`.
// - GET  /__events → { ok, events: [{ event, names }] } con todos los eventos válidos.
// - POST /__events con { event, names } → valida y escribe los tres archivos.
// Las dos piden la cabecera propia de tools/devTuning.ts. En el build no hace nada (no hay servidor).
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import type { EventDef } from '../src/config/events.ts';
import { format, HEADER, readBody } from './devTuning.ts';

const DIR = 'src/data/events';
const ROUTE = '/__events';
const LANGS = ['es', 'en'] as const;
const i18nFile = (lang: string): string => `src/i18n/${lang}.json`;

type Names = { es: string; en: string };
/** El validador vive en src/config: se carga con Vite (ssrLoadModule) para no meter la config del juego en la de Vite. */
type Events = typeof import('../src/config/events.ts');
type Json = Record<string, unknown>;

const readJson = (file: string): Json => JSON.parse(readFileSync(file, 'utf8')) as Json;

function nameOf(i18n: Json, id: string): string {
  const events = i18n.events as Json | undefined;
  return typeof events?.[id] === 'string' ? events[id] : id;
}

/** Eventos guardados que pasan la validación, con sus nombres; los que no, se saltan con un aviso. */
export function listEvents(ev: Events, dir = DIR): { event: EventDef; names: Names }[] {
  if (!existsSync(dir)) return [];
  const [es, en] = LANGS.map((l) => readJson(i18nFile(l)));
  const out: { event: EventDef; names: Names }[] = [];
  for (const f of readdirSync(dir)
    .filter((n) => n.endsWith('.json'))
    .sort()) {
    try {
      const check = ev.validateEvent(readJson(join(dir, f)));
      if (!check.ok) throw new Error(check.error);
      const id = check.event.id;
      out.push({ event: check.event, names: { es: nameOf(es!, id), en: nameOf(en!, id) } });
    } catch (e) {
      console.warn(`[events] ${f} no es válido:`, e instanceof Error ? e.message : e);
    }
  }
  return out;
}

async function save(event: EventDef, names: Names): Promise<string> {
  mkdirSync(DIR, { recursive: true });
  const file = join(DIR, `${event.id}.json`);
  writeFileSync(file, await format(event as unknown as Json, file));
  for (const lang of LANGS) {
    const path = i18nFile(lang);
    const data = readJson(path);
    const events = (data.events ?? {}) as Json;
    data.events = { ...events, [event.id]: names[lang] };
    writeFileSync(path, await format(data, path));
  }
  return file;
}

function reply(res: ServerResponse, status: number, body: Json): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export function devEvents(): Plugin {
  return {
    name: 'atomicash-dev-events',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(ROUTE, (req, res) => {
        if (req.headers[HEADER] !== '1')
          return reply(res, 403, { ok: false, error: 'Falta la cabecera de desarrollo' });
        if (req.method !== 'GET' && req.method !== 'POST')
          return reply(res, 405, { ok: false, error: 'Solo GET o POST' });
        Promise.all([
          server.ssrLoadModule('/src/config/events.ts') as Promise<Events>,
          req.method === 'POST' ? readBody(req) : '',
        ])
          .then(async ([ev, text]) => {
            if (req.method === 'GET') return reply(res, 200, { ok: true, events: listEvents(ev) });
            let body: unknown;
            try {
              body = JSON.parse(text);
            } catch {
              return reply(res, 400, { ok: false, error: 'No es JSON válido' });
            }
            const b = (body ?? {}) as Json;
            const check = ev.validateEvent(b.event);
            if (!check.ok) return reply(res, 400, check);
            if (!ev.validateEventNames(b.names))
              return reply(res, 400, { ok: false, error: 'Faltan los nombres ES/EN (1–60 caracteres)' });
            reply(res, 200, { ok: true, file: await save(check.event, b.names) });
          })
          .catch((e: unknown) =>
            reply(res, 500, { ok: false, error: e instanceof Error ? e.message : String(e) }),
          );
      });
    },
  };
}
