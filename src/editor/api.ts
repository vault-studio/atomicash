// Llamadas al plugin de desarrollo tools/devEvents.ts (`/__events`).
import { validateEvent, type EventDef } from '../config/events';

export interface SavedEvent {
  readonly event: EventDef;
  readonly names: { es: string; en: string };
}

const ROUTE = '/__events';
/** Cabecera propia de los plugins de desarrollo (tools/devTuning.ts). */
const HEADERS = { 'x-atomicash-dev': '1' };

type Reply = { ok: boolean; error?: string; events?: unknown[]; file?: string };

async function call(init?: RequestInit): Promise<Reply> {
  const r = await fetch(ROUTE, { ...init, headers: { ...HEADERS, ...init?.headers }, cache: 'no-store' });
  const body = (await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }))) as Reply;
  if (!r.ok || !body.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
  return body;
}

/** Eventos guardados en src/data/events/, ordenados por id. */
export async function listSaved(): Promise<SavedEvent[]> {
  const { events = [] } = await call();
  return events.flatMap((raw) => {
    const r = raw as SavedEvent;
    const check = validateEvent(r.event);
    return check.ok ? [{ event: check.event, names: r.names }] : [];
  });
}

/** Guarda el evento y sus nombres; devuelve la ruta del archivo. */
export async function saveEvent(event: EventDef, names: { es: string; en: string }): Promise<string> {
  const { file = '' } = await call({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, names }),
  });
  return file;
}
