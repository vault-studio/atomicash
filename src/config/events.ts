// Eventos especiales diseñados con el editor (editor.html, solo en desarrollo). Cada uno se guarda en
// `src/data/events/<id>.json` y su nombre visible en i18n (`events.<id>`). Todavía no entran en el juego.
// TS puro: lo usan el editor, el plugin de Vite que guarda (tools/devEvents.ts) y los tests.
import { ACT_IDS, type ActId } from './acts';
import { PROP_LIST } from './props';

export const EVENT_VERSION = 1;
/** Lado del mapa del editor, en casillas (impar: hay una casilla central). */
export const EVENT_SIZE = 15;

/** Bioma del evento: el de un acto o cualquiera. */
export type EventBiome = ActId | 'any';
export const EVENT_BIOMES: readonly EventBiome[] = [...ACT_IDS, 'any'];

export type PieceType = 'prop' | 'enemy' | 'pickup';
export const PIECE_TYPES: readonly PieceType[] = ['prop', 'enemy', 'pickup'];

/**
 * Una pieza del evento. `x`/`y`: casilla relativa a la central (0, 0); en los objetos de varias casillas, la de
 * arriba a la izquierda de su huella. `id`: archivo del objeto sin `.png` (props.json), clave de pickups.json o ID
 * del enemigo. `count`: enemigos en esa casilla (1 en el resto).
 */
export interface EventPiece {
  readonly type: PieceType;
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly flip: boolean;
  readonly blocks: boolean;
  readonly count: number;
}

export interface EventDef {
  readonly version: number;
  readonly id: string;
  readonly biome: EventBiome;
  readonly size: number;
  readonly pieces: readonly EventPiece[];
}

export type EventCheck = { ok: true; event: EventDef } | { ok: false; error: string };

export const EVENT_ID_RE = /^[a-z0-9_]{1,40}$/;
const PIECE_ID_RE = /^[a-z0-9_]{1,60}$/;
export const MAX_ENEMY_COUNT = 99;

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

/** Objeto del mapa con ese ID (archivo sin extensión), o undefined si no está en props.json. */
export const propById = (id: string) => PROP_LIST.find((p) => p.file.replace(/\.png$/, '') === id);

/**
 * Casillas que ocupa una pieza. Los de 2 casillas van en fila por el eje x del mundo; volteados en horizontal se
 * ven a lo largo del eje y. Los edificios ocupan 3×3. Los objetos que ya no estén en props.json cuentan como 1.
 */
export function pieceCells(p: Pick<EventPiece, 'type' | 'id' | 'x' | 'y' | 'flip'>): [number, number][] {
  const cells = p.type === 'prop' ? (propById(p.id)?.cells ?? 1) : 1;
  if (cells === 2)
    return p.flip
      ? [
          [p.x, p.y],
          [p.x, p.y + 1],
        ]
      : [
          [p.x, p.y],
          [p.x + 1, p.y],
        ];
  if (cells === 9) {
    const out: [number, number][] = [];
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) out.push([p.x + i, p.y + j]);
    return out;
  }
  return [[p.x, p.y]];
}

function checkPiece(raw: unknown, k: number, half: number): string | EventPiece {
  const at = `Pieza ${k}`;
  if (!isRec(raw)) return `${at}: debe ser un objeto`;
  const { type, id, x, y, flip, blocks, count } = raw;
  if (!PIECE_TYPES.includes(type as PieceType)) return `${at}: tipo desconocido`;
  if (typeof id !== 'string' || !PIECE_ID_RE.test(id)) return `${at}: id no válido`;
  if (!isInt(x) || !isInt(y)) return `${at}: casilla no entera`;
  if (typeof flip !== 'boolean' || typeof blocks !== 'boolean') return `${at}: flip y blocks son booleanos`;
  if (!isInt(count) || count < 1 || count > MAX_ENEMY_COUNT) return `${at}: cantidad fuera de rango`;
  if (type !== 'enemy' && count !== 1) return `${at}: solo los enemigos llevan cantidad`;
  if (type !== 'prop' && blocks) return `${at}: solo los objetos del mapa bloquean el paso`;
  const piece: EventPiece = { type: type as PieceType, id, x, y, flip, blocks, count };
  if (pieceCells(piece).some(([cx, cy]) => Math.abs(cx) > half || Math.abs(cy) > half))
    return `${at}: se sale del mapa`;
  return piece;
}

/** Valida un JSON de evento (ya parseado). Función pura: la usan el editor, el plugin y los tests. */
export function validateEvent(raw: unknown): EventCheck {
  if (!isRec(raw)) return { ok: false, error: 'La raíz debe ser un objeto' };
  if (raw.version !== EVENT_VERSION) return { ok: false, error: `Versión distinta de ${EVENT_VERSION}` };
  if (typeof raw.id !== 'string' || !EVENT_ID_RE.test(raw.id))
    return { ok: false, error: 'id: solo minúsculas, números y _ (1–40)' };
  if (!EVENT_BIOMES.includes(raw.biome as EventBiome)) return { ok: false, error: 'Bioma desconocido' };
  if (!isInt(raw.size) || raw.size < 1 || raw.size % 2 === 0)
    return { ok: false, error: 'El tamaño debe ser un entero impar' };
  if (!Array.isArray(raw.pieces)) return { ok: false, error: 'Falta la lista de piezas' };
  const half = (raw.size - 1) / 2;
  const pieces: EventPiece[] = [];
  const solid = new Set<string>();
  const enemies = new Set<string>();
  for (let k = 0; k < raw.pieces.length; k++) {
    const p = checkPiece(raw.pieces[k], k, half);
    if (typeof p === 'string') return { ok: false, error: p };
    const used = p.type === 'enemy' ? enemies : solid;
    for (const [cx, cy] of pieceCells(p)) {
      const key = `${cx},${cy}`;
      if (used.has(key)) return { ok: false, error: `Pieza ${k}: casilla ${key} ya ocupada` };
      used.add(key);
    }
    pieces.push(p);
  }
  const event: EventDef = {
    version: EVENT_VERSION,
    id: raw.id,
    biome: raw.biome as EventBiome,
    size: raw.size,
    pieces,
  };
  return { ok: true, event };
}

/** Nombre visible en los dos idiomas: texto no vacío de hasta 60 caracteres. */
export function validateEventNames(raw: unknown): raw is { es: string; en: string } {
  const ok = (v: unknown): boolean => typeof v === 'string' && v.trim().length > 0 && v.length <= 60;
  return isRec(raw) && ok(raw.es) && ok(raw.en);
}
