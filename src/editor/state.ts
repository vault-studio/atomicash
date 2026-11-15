// Estado del editor de eventos (Zustand): metadatos, piezas, selección y deshacer.
import { create } from 'zustand';
import {
  EVENT_SIZE,
  EVENT_VERSION,
  MAX_ENEMY_COUNT,
  pieceCells,
  type EventBiome,
  type EventDef,
  type EventPiece,
} from '../config/events';
import type { Entry } from './catalog';
import { inside } from './geometry';

export interface Piece extends EventPiece {
  readonly uid: number;
}

interface Snapshot {
  readonly pieces: readonly Piece[];
  readonly biome: EventBiome;
  readonly size: number;
}

export interface EditorState {
  id: string;
  nameEs: string;
  nameEn: string;
  biome: EventBiome;
  /** Lado del mapa en casillas (EVENT_SIZES). */
  size: number;
  /** Ocultar el decorado de otros biomas en el listado. */
  filterBiome: boolean;
  pieces: readonly Piece[];
  selected: number | null;
  past: readonly Snapshot[];
  message: string;
  setMeta(m: Partial<Pick<EditorState, 'id' | 'nameEs' | 'nameEn' | 'filterBiome' | 'message'>>): void;
  setBiome(b: EventBiome): void;
  /** Cambia el lado; no encoge si alguna pieza quedaría fuera. */
  setSize(size: number): void;
  add(entry: Entry, x: number, y: number): void;
  move(uid: number, x: number, y: number): void;
  update(uid: number, patch: Partial<Pick<EventPiece, 'flip' | 'blocks' | 'count'>>): void;
  remove(uid: number): void;
  select(uid: number | null): void;
  undo(): void;
  load(event: EventDef, names: { es: string; en: string }): void;
  reset(): void;
  toEvent(): EventDef;
}

const MAX_UNDO = 200;
let nextUid = 1;

/** ¿Cabe la pieza? Dentro del mapa; decorado y recogibles, uno por casilla; enemigos, un grupo por casilla. */
export function fits(pieces: readonly Piece[], p: EventPiece, ignore: number | null, size: number): boolean {
  const cells = pieceCells(p);
  if (!cells.every(([x, y]) => inside(x, y, size))) return false;
  const enemy = p.type === 'enemy';
  const taken = new Set<string>();
  for (const q of pieces)
    if (q.uid !== ignore && (q.type === 'enemy') === enemy)
      for (const [x, y] of pieceCells(q)) taken.add(`${x},${y}`);
  return cells.every(([x, y]) => !taken.has(`${x},${y}`));
}

const blank = {
  id: '',
  nameEs: '',
  nameEn: '',
  biome: 'any' as EventBiome,
  size: EVENT_SIZE as number,
  pieces: [] as Piece[],
  selected: null,
  past: [],
};

export const useEditor = create<EditorState>()((set, get) => {
  /** Guarda el estado actual para deshacer y aplica el cambio. */
  const commit = (next: Partial<Snapshot> & { selected?: number | null; message?: string }): void => {
    const { pieces, biome, size, past } = get();
    set({ past: [...past, { pieces, biome, size }].slice(-MAX_UNDO), message: '', ...next });
  };
  const edit = (uid: number, fn: (p: Piece) => Piece | null): void => {
    const pieces = get().pieces;
    const p = pieces.find((q) => q.uid === uid);
    const n = p && fn(p);
    if (!p || !n) return;
    commit({ pieces: pieces.map((q) => (q.uid === uid ? n : q)) });
  };

  return {
    ...blank,
    filterBiome: true,
    message: '',
    setMeta: (m) => set(m),
    setBiome: (biome) => biome !== get().biome && commit({ biome }),
    setSize(size) {
      const { pieces, size: now } = get();
      if (size === now) return;
      const out = pieces.filter((p) => !pieceCells(p).every(([x, y]) => inside(x, y, size))).length;
      if (out > 0) return set({ message: `${out} pieza(s) quedarían fuera: muévelas o bórralas antes` });
      commit({ size });
    },
    add(entry, x, y) {
      const pieces = get().pieces;
      const p: EventPiece = {
        type: entry.type,
        id: entry.id,
        x,
        y,
        flip: false,
        blocks: entry.blocks,
        count: 1,
      };
      const same = pieces.find((q) => q.type === 'enemy' && p.type === 'enemy' && q.x === x && q.y === y);
      if (same?.id === p.id) {
        // Soltar el mismo enemigo en su casilla suma uno al grupo.
        const count = Math.min(MAX_ENEMY_COUNT, same.count + 1);
        commit({ pieces: pieces.map((q) => (q === same ? { ...q, count } : q)), selected: same.uid });
        return;
      }
      if (!fits(pieces, p, null, get().size))
        return set({ message: 'Esa casilla está ocupada o se sale del mapa' });
      const uid = nextUid++;
      commit({ pieces: [...pieces, { ...p, uid }], selected: uid });
    },
    move(uid, x, y) {
      const { pieces } = get();
      edit(uid, (p) => {
        if (p.x === x && p.y === y) return null;
        const n = { ...p, x, y };
        if (fits(pieces, n, uid, get().size)) return n;
        set({ message: 'No cabe ahí' });
        return null;
      });
    },
    update(uid, patch) {
      const { pieces } = get();
      edit(uid, (p) => {
        const n = { ...p, ...patch };
        if (fits(pieces, n, uid, get().size)) return n;
        set({ message: 'Volteado no cabe: muévelo antes' });
        return null;
      });
    },
    remove(uid) {
      const { pieces, selected } = get();
      if (!pieces.some((p) => p.uid === uid)) return;
      commit({ pieces: pieces.filter((p) => p.uid !== uid), selected: selected === uid ? null : selected });
    },
    select: (selected) => set({ selected }),
    undo() {
      const { past, selected } = get();
      const last = past[past.length - 1];
      if (!last) return;
      const keep = last.pieces.some((p) => p.uid === selected) ? selected : null;
      set({ ...last, past: past.slice(0, -1), selected: keep, message: '' });
    },
    load(event, names) {
      const pieces = event.pieces.map((p) => ({ ...p, uid: nextUid++ }));
      set({
        ...blank,
        id: event.id,
        nameEs: names.es,
        nameEn: names.en,
        biome: event.biome,
        size: event.size,
        pieces,
        message: `Abierto «${event.id}»`,
      });
    },
    reset: () => set({ ...blank, message: 'Evento nuevo' }),
    toEvent() {
      const { id, biome, size, pieces } = get();
      const list = pieces.map(({ type, id: pid, x, y, flip, blocks, count }) => ({
        type,
        id: pid,
        x,
        y,
        flip,
        blocks,
        count,
      }));
      return { version: EVENT_VERSION, id: id.trim(), biome, size, pieces: list };
    },
  };
});
