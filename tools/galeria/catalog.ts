// Catálogo de la Galería de assets. Función pura: escanea el disco en cada llamada.
// Solo sintaxis borrable (Node ejecuta este archivo directamente, sin compilar).
import { promises as fs } from 'node:fs';
import path from 'node:path';

export type Kind = 'animation' | 'strip' | 'image' | 'audio' | 'model';

export interface CatalogItem {
  id: string;
  kind: Kind;
  section: string;
  group: string;
  subgroup?: string;
  name: string;
  path: string;
  size: number;
  mtime: number;
  meta?: Record<string, unknown>;
  sidecars: string[];
}

export interface CatalogSection {
  id: string;
  title: string;
  auto: boolean;
  local: boolean;
  count: number;
}

export interface Catalog {
  sections: CatalogSection[];
  items: CatalogItem[];
}

/** Raíces servibles por /files/ (relativas a la raíz del proyecto). */
export const FILE_ROOTS = ['assets', 'ARTE', 'NOVEDADES'];

const IMAGE_EXT = new Set(['.png', '.webp', '.jpg', '.jpeg', '.gif']);
const AUDIO_EXT = new Set(['.m4a', '.mp3', '.ogg', '.wav', '.flac']);
const MODEL_EXT = new Set(['.glb', '.gltf', '.fbx', '.obj', '.blend']);

interface SectionDef {
  id: string;
  title: string;
  local?: boolean;
  groups?: string[];
}

const SECTIONS: SectionDef[] = [
  { id: 'personajes', title: 'Personajes' },
  { id: 'enemigos', title: 'Enemigos' },
  { id: 'jefes', title: 'Jefes' },
  { id: 'armas', title: 'Armas' },
  { id: 'iconos', title: 'Iconos' },
  { id: 'retratos', title: 'Retratos', groups: ['retratos', 'cabezas'] },
  { id: 'mapa', title: 'Mapa', groups: ['suelos', 'decorado', 'objetos'] },
  { id: 'efectos', title: 'Efectos' },
  { id: 'audio', title: 'Audio', groups: ['sfx', 'amb', 'music'] },
  { id: 'app', title: 'Icono de la app' },
  { id: 'hojas', title: 'Hojas originales', local: true },
  { id: 'modelos', title: 'Modelos 3D', local: true },
];

const SPRITE_SECTIONS: Record<string, string> = {
  characters: 'personajes',
  enemies: 'enemigos',
  bosses: 'jefes',
};

const MAP_GROUPS: Record<string, string> = { tiles: 'suelos', props: 'decorado', pickups: 'objetos' };

interface Place {
  section: string;
  group: string;
  title?: string; // solo secciones automáticas
}

function autoPlace(title: string, group: string): Place {
  return { section: `auto:${title}`, title, group };
}

/** Ubica un archivo de assets/ (partes de la ruta relativa a assets/, incluido el nombre). */
function classifyAsset(parts: string[], weapons: Set<string>, ext: string): Place {
  const top = parts[0] as string;
  const dirs = parts.slice(1, -1);
  const file = parts[parts.length - 1] as string;
  const base = file.slice(0, file.length - ext.length);

  if (parts.length === 1) return autoPlace('assets', 'assets');

  if (top === 'sprites') {
    const cat = parts[1] as string;
    const known = SPRITE_SECTIONS[cat];
    if (parts.length >= 4) {
      const id = parts[2] as string;
      if (known) return { section: known, group: id };
      return autoPlace(`sprites/${cat}`, id);
    }
    return autoPlace(parts.length === 3 ? `sprites/${cat}` : 'sprites', cat);
  }
  if (top === 'icons') {
    if (dirs.length === 0) {
      return weapons.has(base) ? { section: 'armas', group: 'armas' } : { section: 'iconos', group: 'otros' };
    }
    return { section: 'iconos', group: dirs.join('/') };
  }
  if (top === 'portraits') {
    return {
      section: 'retratos',
      group: dirs.length === 0 ? 'retratos' : dirs[0] === 'heads' ? 'cabezas' : dirs.join('/'),
    };
  }
  if (top === 'tiles' || top === 'props' || top === 'pickups') {
    return { section: 'mapa', group: MAP_GROUPS[top] as string };
  }
  if (top === 'fx') return { section: 'efectos', group: dirs.length ? dirs.join('/') : 'efectos' };
  if (top === 'audio') {
    const g = parts[1] as string;
    if (parts.length >= 3 && (g === 'sfx' || g === 'amb' || g === 'music'))
      return { section: 'audio', group: g };
    return autoPlace('audio', dirs.join('/') || 'audio');
  }
  if (top === 'app') return { section: 'app', group: 'app' };
  return autoPlace(top, dirs.join('/') || top);
}

const naturalCompare = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true });

async function readJson(file: string): Promise<unknown> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return undefined;
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

interface Found {
  rel: string; // ruta relativa a la raíz, con /
  size: number;
  mtime: number;
}

async function walk(root: string, rel: string, skip: (rel: string) => boolean, out: Found[]): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(path.join(root, rel), { withFileTypes: true });
  } catch {
    return; // carpeta inexistente
  }
  const files: string[] = [];
  for (const e of entries) {
    const childRel = `${rel}/${e.name}`;
    if (skip(childRel)) continue;
    if (e.isDirectory()) await walk(root, childRel, skip, out);
    else if (e.isFile()) files.push(childRel);
  }
  const stats = await Promise.all(files.map((f) => fs.stat(path.join(root, f)).catch(() => null)));
  files.forEach((f, i) => {
    const st = stats[i];
    if (st) out.push({ rel: f, size: st.size, mtime: Math.floor(st.mtimeMs) });
  });
}

export async function buildCatalog(root: string): Promise<Catalog> {
  const tuning = await readJson(path.join(root, 'src/data/tuning.json'));
  const weaponIds = new Set<string>(
    isRecord(tuning) && isRecord(tuning.weapons) ? Object.keys(tuning.weapons) : [],
  );

  const assets: Found[] = [];
  const arte: Found[] = [];
  const novedades: Found[] = [];
  await Promise.all([
    walk(root, 'assets', () => false, assets),
    walk(root, 'ARTE', (r) => r.toLowerCase() === 'arte/audio', arte),
    walk(root, 'NOVEDADES', () => false, novedades),
  ]);

  const exists = new Set(assets.map((f) => f.rel));
  const fxFrames = new Map<string, Record<string, unknown>>();
  const fxJson = await readJson(path.join(root, 'assets/fx/fx.json'));
  if (isRecord(fxJson)) {
    for (const v of Object.values(fxJson)) {
      if (isRecord(v) && typeof v.file === 'string') fxFrames.set(v.file, v);
    }
  }

  // Sidecars por carpeta: <carpeta>/<carpeta>.json y CREDITS.md, si existen.
  const sidecarsOf = (dirRel: string): string[] => {
    const out: string[] = [];
    let cur = dirRel;
    while (cur.includes('/')) {
      const name = cur.slice(cur.lastIndexOf('/') + 1);
      for (const cand of [`${cur}/${name}.json`, `${cur}/CREDITS.md`]) {
        if (!exists.has(cand)) continue;
        out.push(cand);
      }
      cur = cur.slice(0, cur.lastIndexOf('/'));
    }
    return out;
  };

  const items: CatalogItem[] = [];
  const autoTitles = new Map<string, string>();

  for (const f of assets) {
    const rel = f.rel;
    const file = rel.slice(rel.lastIndexOf('/') + 1);
    const ext = path.posix.extname(file).toLowerCase();
    if (file.endsWith('_preview.gif')) continue;
    const isImage = IMAGE_EXT.has(ext);
    const isAudio = AUDIO_EXT.has(ext);
    const isModel = MODEL_EXT.has(ext);
    if (!isImage && !isAudio && !isModel) continue;

    const parts = rel.split('/').slice(1);
    const place = classifyAsset(parts, weaponIds, ext);
    const dirRel = rel.slice(0, rel.lastIndexOf('/'));
    const base = file.slice(0, file.length - ext.length);
    const sidecars = sidecarsOf(dirRel);

    const item: CatalogItem = {
      id: rel,
      kind: isAudio ? 'audio' : isModel ? 'model' : 'image',
      section: place.section,
      group: place.group,
      name: base,
      path: rel,
      size: f.size,
      mtime: f.mtime,
      sidecars,
    };

    if (isImage && ext === '.png') {
      const jsonRel = `${dirRel}/${base}.json`;
      const j = exists.has(jsonRel) ? await readJson(path.join(root, jsonRel)) : undefined;
      if (isRecord(j) && 'cell' in j && 'frames' in j && 'directions' in j) {
        item.kind = 'animation';
        item.meta = j;
        if (typeof j.anim === 'string') item.name = j.anim;
        item.sidecars = [jsonRel, ...sidecars];
      }
    }
    if (item.kind === 'image' && place.section === 'efectos') {
      const e = fxFrames.get(file);
      if (e && typeof e.frames === 'number' && e.frames > 1) {
        item.kind = 'strip';
        item.meta = { frames: e.frames, w: e.w, h: e.h };
      }
    }
    if (item.kind === 'audio' && place.section === 'audio' && place.group === 'sfx') {
      const m = /^(.*)_\d+$/.exec(base);
      if (m) item.subgroup = m[1] as string;
    }
    if (place.title) autoTitles.set(place.section, place.title);
    items.push(item);
  }

  for (const f of arte) {
    const ext = path.posix.extname(f.rel).toLowerCase();
    if (!['.png', '.webp', '.jpg', '.jpeg'].includes(ext)) continue;
    const parts = f.rel.split('/').slice(1);
    const dirs = parts.slice(0, -1);
    items.push({
      id: f.rel,
      kind: 'image',
      section: 'hojas',
      group: dirs.length ? dirs.join('/') : 'ARTE',
      name: path.posix.basename(f.rel, ext),
      path: f.rel,
      size: f.size,
      mtime: f.mtime,
      sidecars: [],
    });
  }

  for (const f of novedades) {
    const ext = path.posix.extname(f.rel).toLowerCase();
    if (!MODEL_EXT.has(ext)) continue;
    const dirs = f.rel.split('/').slice(1, -1);
    items.push({
      id: f.rel,
      kind: 'model',
      section: 'modelos',
      group: dirs.length ? dirs.join('/') : 'NOVEDADES',
      name: path.posix.basename(f.rel, ext),
      path: f.rel,
      size: f.size,
      mtime: f.mtime,
      sidecars: [],
    });
  }

  // Secciones: las fijas en orden, las automáticas al final (alfabéticas).
  const defs: (SectionDef & { auto: boolean })[] = SECTIONS.map((s) => ({ ...s, auto: false }));
  const autoIds = [...autoTitles.keys()].sort((a, b) => naturalCompare(a, b));
  for (const id of autoIds) defs.push({ id, title: autoTitles.get(id) as string, auto: true });
  const order = new Map(defs.map((d, i) => [d.id, i]));
  const groupRank = (sec: string, group: string): number => {
    const idx = defs.find((d) => d.id === sec)?.groups?.indexOf(group) ?? -1;
    return idx < 0 ? 999 : idx;
  };

  items.sort(
    (a, b) =>
      (order.get(a.section) as number) - (order.get(b.section) as number) ||
      groupRank(a.section, a.group) - groupRank(b.section, b.group) ||
      naturalCompare(a.group, b.group) ||
      naturalCompare(a.path, b.path),
  );

  const counts = new Map<string, number>();
  for (const it of items) counts.set(it.section, (counts.get(it.section) ?? 0) + 1);
  const sections: CatalogSection[] = defs
    .filter((d) => counts.has(d.id))
    .map((d) => ({
      id: d.id,
      title: d.title,
      auto: d.auto,
      local: !!d.local,
      count: counts.get(d.id) as number,
    }));

  return { sections, items };
}

/**
 * Valida la ruta de /files/<ruta>: devuelve la ruta relativa normalizada (con /) o null si es
 * inválida, absoluta, escapa con `..` (también codificado) o cae fuera de las raíces permitidas.
 */
export function safeRelPath(raw: string): string | null {
  let s: string;
  try {
    s = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (s.includes('\0') || s.includes('\\')) return null;
  if (s.startsWith('/') || /^[a-zA-Z]:/.test(s)) return null;
  const segs = s.split('/');
  if (segs.some((g) => g === '' || g === '.' || g === '..')) return null;
  const first = segs[0];
  if (first === undefined || !FILE_ROOTS.includes(first) || segs.length < 2) return null;
  return segs.join('/');
}
