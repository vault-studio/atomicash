// Plugin de Vite solo para el servidor de desarrollo: el depurador (src/app/debug) guarda los valores de balance
// actuales como nuevos valores por defecto con un POST a `/__tuning`, que sobrescribe `src/data/tuning.json`.
// En el build no hace nada (no hay servidor), y el panel tampoco entra en el bundle.
import { readFileSync, writeFileSync } from 'node:fs';
import type { IncomingMessage } from 'node:http';
import type { Plugin } from 'vite';

const FILE = 'src/data/tuning.json';
const ROUTE = '/__tuning';
/** Cabecera propia: obliga a una petición «con preflight», que el navegador no manda desde otras páginas. */
const HEADER = 'x-atomicash-dev';
const MAX_BYTES = 1_000_000;

export type TuningCheck = { ok: true; data: Record<string, unknown> } | { ok: false; error: string };

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * El texto recibido debe ser un JSON objeto con las mismas secciones de primer nivel que `reference` (cada una con
 * el mismo tipo: objeto o lista). Función pura: la usa el plugin y los tests.
 */
export function validateTuningText(text: string, reference: Record<string, unknown>): TuningCheck {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'No es JSON válido' };
  }
  if (!isRec(data)) return { ok: false, error: 'La raíz debe ser un objeto' };
  const want = Object.keys(reference);
  const got = Object.keys(data);
  const missing = want.filter((k) => !got.includes(k));
  const extra = got.filter((k) => !want.includes(k));
  if (missing.length || extra.length) {
    const parts = [
      missing.length ? `faltan: ${missing.join(', ')}` : '',
      extra.length ? `sobran: ${extra.join(', ')}` : '',
    ].filter(Boolean);
    return { ok: false, error: `Secciones distintas (${parts.join('; ')})` };
  }
  for (const k of want) {
    if (Array.isArray(reference[k]) !== Array.isArray(data[k]) || isRec(reference[k]) !== isRec(data[k]))
      return { ok: false, error: `La sección «${k}» cambia de tipo` };
  }
  return { ok: true, data };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BYTES) {
        reject(new Error('Cuerpo demasiado grande'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** Da al JSON el formato del proyecto (Prettier) para que el diff solo muestre los valores cambiados. */
async function format(json: Record<string, unknown>): Promise<string> {
  const raw = JSON.stringify(json, null, 2) + '\n';
  try {
    const prettier = await import('prettier');
    const cfg = (await prettier.resolveConfig(FILE)) ?? {};
    return await prettier.format(raw, { ...cfg, parser: 'json' });
  } catch {
    return raw;
  }
}

export function devTuning(): Plugin {
  return {
    name: 'atomicash-dev-tuning',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(ROUTE, (req, res) => {
        const reply = (status: number, body: Record<string, unknown>): void => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
        };
        if (req.method !== 'POST') return reply(405, { ok: false, error: 'Solo POST' });
        if (req.headers[HEADER] !== '1')
          return reply(403, { ok: false, error: 'Falta la cabecera de desarrollo' });
        readBody(req)
          .then(async (text) => {
            const reference = JSON.parse(readFileSync(FILE, 'utf8')) as Record<string, unknown>;
            const check = validateTuningText(text, reference);
            if (!check.ok) return reply(400, check);
            writeFileSync(FILE, await format(check.data));
            reply(200, { ok: true, file: FILE });
          })
          .catch((e: unknown) =>
            reply(500, { ok: false, error: e instanceof Error ? e.message : String(e) }),
          );
      });
    },
  };
}
