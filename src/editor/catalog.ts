// Catálogo del editor: lo que se puede colocar, leído de los archivos de arte. Lo que se importe después aparece
// solo: `assets/manifest.json` (hojas de enemigos y jefes), `assets/props/props.json` y `assets/pickups/pickups.json`.
import { BOSS_IDS, MIRROR_ID, STAT_ENEMY_IDS } from '../config/enemies';
import { ENTITIES, isEntityId } from '../config/entities';
import type { EventBiome, PieceType } from '../config/events';
import { PROP_LIST, PROP_SCALE, PROP_SHAPES, RUBBLE_PROPS, type PropInfo } from '../config/props';
import { PICKUP_ART, SPRITES, VIEW } from '../config/render';
import { parseSpriteMeta, rowIndex } from '../render/spriteMeta';
import { TILE_SCALE } from './geometry';

/** Recorte de una imagen: el primer frame de una hoja, o la imagen entera. */
export interface Art {
  readonly url: string;
  readonly sx: number;
  readonly sy: number;
  readonly sw: number;
  readonly sh: number;
  readonly imgW: number;
  readonly imgH: number;
  /** Punto de apoyo en fracción del recorte. */
  readonly ax: number;
  readonly ay: number;
  /** Px de mundo por px de imagen. */
  readonly scale: number;
}

export type Group = 'decor' | 'enemies' | 'bosses' | 'pickups';
export const GROUP_LABELS: Readonly<Record<Group, string>> = {
  decor: 'Decorado y objetos del mapa',
  enemies: 'Enemigos',
  bosses: 'Jefes',
  pickups: 'Recogibles',
};

export interface Entry {
  readonly key: string;
  readonly type: PieceType;
  readonly id: string;
  readonly group: Group;
  /** Bioma del decorado; enemigos y recogibles sirven en cualquiera. */
  readonly biome: EventBiome;
  /** null: placeholder (círculo de color). */
  readonly art: Art | null;
  readonly color: string;
  readonly radius: number;
  /** Casillas que ocupa (decorado). */
  readonly cells: number;
  readonly blocks: boolean;
}

export const entryKey = (type: PieceType, id: string): string => `${type}:${id}`;

/**
 * Radio de referencia de un recogible en px de mundo. DECISIÓN: el juego dibuja cada uno con su radio de recogida
 * (que no está en pickups.json); para el editor basta un radio común, con el ancho relativo de PICKUP_ART.w.
 */
const PICKUP_R = 14;
/** Animación de la que se toma el primer frame, por orden de preferencia. */
const ANIM_ORDER = ['move', 'run', 'idle'];
const BASE = '/' + SPRITES.assetBase;

const getJson = async <T>(url: string): Promise<T | null> => {
  const r = await fetch(url, { cache: 'no-store' });
  return r.ok ? ((await r.json()) as T) : null;
};

function imageSize(url: string): Promise<[number, number]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve([img.naturalWidth, img.naturalHeight]);
    img.onerror = () => resolve([0, 0]);
    img.src = url;
  });
}

function propEntries(): Entry[] {
  // props.json también trae el tamaño de cada imagen (w, h), aunque PropInfo no lo declare.
  return (PROP_LIST as readonly (PropInfo & { w: number; h: number })[]).map((p, k) => {
    const id = p.file.replace(/\.png$/, '');
    const s = PROP_SHAPES[k]!;
    const art: Art = {
      url: `${BASE}props/${p.file}`,
      ...{ sx: 0, sy: 0, sw: p.w, sh: p.h, imgW: p.w, imgH: p.h },
      ax: p.ax,
      ay: p.ay,
      scale: TILE_SCALE * PROP_SCALE[k]!,
    };
    const biome: EventBiome = RUBBLE_PROPS.includes(k) ? 'any' : ((p.act ?? 1) as EventBiome);
    const blocks = s.r > 0 || s.hx > 0 || s.hy > 0;
    return {
      key: entryKey('prop', id),
      type: 'prop',
      id,
      group: 'decor',
      biome,
      art,
      color: '#888',
      radius: 30,
      cells: p.cells,
      blocks,
    };
  });
}

async function pickupEntries(): Promise<Entry[]> {
  const index =
    (await getJson<Record<string, { file: string; ay: number; bw: number }>>(PICKUP_ART.index)) ?? {};
  return Promise.all(
    Object.entries(index).map(async ([id, a]) => {
      const url = `/${PICKUP_ART.dir}${a.file}`;
      const [w, h] = await imageSize(url);
      const width = (PICKUP_ART.fixed[id] ?? (PICKUP_ART.w[id] ?? 3) * PICKUP_R) / a.bw;
      const art: Art = { url, sx: 0, sy: 0, sw: w, sh: h, imgW: w, imgH: h, ax: 0.5, ay: a.ay, scale: width };
      return {
        key: entryKey('pickup', id),
        type: 'pickup' as const,
        id,
        group: 'pickups' as const,
        biome: 'any' as const,
        art: w ? art : null,
        color: '#e8d27a',
        radius: PICKUP_R,
        cells: 1,
        blocks: false,
      };
    }),
  );
}

/** Primer frame (mirando al sur) de la primera animación disponible del enemigo. */
async function enemyArt(id: string, sheets: readonly string[], cellScale: number): Promise<Art | null> {
  const mine = sheets.filter((s) => s.split('/')[1] === id);
  const pick = ANIM_ORDER.map((a) => mine.find((s) => s.endsWith(`/${id}_${a}`))).find(Boolean) ?? mine[0];
  if (!pick) return null;
  const url = `${BASE}sprites/${pick}`;
  const [raw, [w, h]] = await Promise.all([getJson<unknown>(url + '.json'), imageSize(url + '.png')]);
  const meta = parseSpriteMeta(raw, w);
  if (!meta || !w) return null;
  const [cw, ch] = meta.cell;
  const sy = rowIndex(meta, 0) * ch;
  if (cw > w || sy + ch > h) return null;
  const scale = (cellScale * VIEW.refCell) / cw;
  return {
    url: url + '.png',
    sx: 0,
    sy,
    sw: cw,
    sh: ch,
    imgW: w,
    imgH: h,
    ax: meta.pivot[0] / cw,
    ay: meta.pivot[1] / ch,
    scale,
  };
}

async function enemyEntries(): Promise<Entry[]> {
  const sheets = ((await getJson<string[]>(`${BASE}${SPRITES.manifest}`)) ?? []).filter(
    (s) => s.startsWith('enemies/') || s.startsWith('bosses/'),
  );
  const fromArt = sheets.map((s) => s.split('/')[1]!);
  const ids = [...new Set([...STAT_ENEMY_IDS.filter((id) => id !== MIRROR_ID), ...fromArt])].sort();
  return Promise.all(
    ids.map(async (id) => {
      const def = isEntityId(id) ? ENTITIES[id] : null;
      const boss =
        (BOSS_IDS as readonly string[]).includes(id) || sheets.some((s) => s.startsWith(`bosses/${id}/`));
      const size = def?.size ?? 1.3;
      const cellScale = size * VIEW.scalePerSize[def?.category ?? (boss ? 'bosses' : 'enemies')];
      const art = await enemyArt(id, sheets, cellScale);
      const radius = size * VIEW.placeholderRadiusPerSize;
      return {
        key: entryKey('enemy', id),
        type: 'enemy' as const,
        id,
        group: boss ? ('bosses' as const) : ('enemies' as const),
        biome: 'any' as const,
        art,
        color: def?.color ?? '#c04040',
        radius,
        cells: 1,
        blocks: false,
      };
    }),
  );
}

export async function loadCatalog(): Promise<Entry[]> {
  const [pickups, enemies] = await Promise.all([pickupEntries(), enemyEntries()]);
  return [...propEntries(), ...enemies, ...pickups];
}
