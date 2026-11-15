// Piezas de los restos de un robot: de color liso o recortadas de su sprite, empaquetadas por entidad.
import { Rectangle, Texture } from 'pixi.js';
import { ENTITIES, type EntityId } from '../../config/entities';
import { FX_ART, VIEW } from '../../config/render';
import type { SpriteLibrary } from '../sprites';
import { shatter, wreckRand, wreckWidth, type Shard } from './wreckMath';

interface Piece {
  readonly tex: Texture;
  /** Centro de la pieza respecto a los pies del robot, en px de mundo. */
  readonly ox: number;
  readonly oy: number;
  /** Parte del robot que ocupa (0–1). */
  readonly frac: number;
  readonly scale: number;
  readonly tint: number;
}

export interface PieceSet {
  readonly pieces: readonly Piece[];
  readonly width: number;
}

export const W = FX_ART.wreck;
const PAD = 2;

const idSeed = (id: string): number => {
  let h = 7;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 9973;
  return h / 9973;
};

function pieceCount(id: EntityId): number {
  const P = W.pieces;
  return Math.min(P.max, Math.round(P.base + ENTITIES[id].size * P.perSize));
}

/** Sin sprite (placeholder): trozos de su color de firma. */
export function colorPieces(id: EntityId): PieceSet {
  const width = wreckWidth(id);
  const n = pieceCount(id);
  const tint = shade(parseInt(ENTITIES[id].color.slice(1), 16), W.colorDark);
  const seed = idSeed(id);
  const pieces: Piece[] = [];
  for (let j = 0; j < n; j++) {
    pieces.push({
      tex: Texture.WHITE,
      ox: (wreckRand(seed, j, 7) - 0.5) * width * 0.5,
      oy: -wreckRand(seed, j, 8) * width * 0.5,
      frac: 1 / n,
      scale: (width * W.colorPiece * (0.6 + 0.8 * wreckRand(seed, j, 9))) / Texture.WHITE.width,
      tint,
    });
  }
  return { pieces, width };
}

/** Coloca los trozos en filas dentro de un lienzo propio. Devuelve su posición en él y el tamaño del lienzo. */
function packShards(shards: readonly Shard[]): { at: [number, number][]; w: number; h: number } {
  let sum = 0;
  let wide = 0;
  for (const s of shards) {
    const sw = s.x1 - s.x0 + 1 + PAD;
    sum += sw * (s.y1 - s.y0 + 1 + PAD);
    wide = Math.max(wide, sw);
  }
  const w = Math.max(wide, Math.ceil(Math.sqrt(sum) * 1.3));
  const at: [number, number][] = [];
  let x = 0;
  let y = 0;
  let row = 0;
  for (const s of shards) {
    const sw = s.x1 - s.x0 + 1 + PAD;
    if (x + sw > w) {
      x = 0;
      y += row;
      row = 0;
    }
    at.push([x, y]);
    x += sw;
    row = Math.max(row, s.y1 - s.y0 + 1 + PAD);
  }
  return { at, w, h: y + row };
}

export function spritePieces(lib: SpriteLibrary, id: EntityId): PieceSet | null {
  const src = lib.frameSource(ENTITIES[id].variantOf ?? id, W.anims, W.dir);
  if (!src) return null;
  const { w: cw, h: ch, pivot } = src;
  const cell = document.createElement('canvas');
  cell.width = cw;
  cell.height = ch;
  const ctx = cell.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(src.image, src.x, src.y, cw, ch, 0, 0, cw, ch);
  const rgba = ctx.getImageData(0, 0, cw, ch).data;
  const alpha = new Uint8Array(cw * ch);
  for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3]!;

  const { owner, seam, shards } = shatter(alpha, cw, ch, pieceCount(id), idSeed(id), W.shatter);
  let total = 0;
  for (const s of shards) total += s.area;
  const kept = shards.filter((s) => s.area >= total * W.minPiece);
  if (kept.length === 0) return null;

  const { at, w: aw, h: ah } = packShards(kept);
  const atlas = document.createElement('canvas');
  atlas.width = aw;
  atlas.height = ah;
  const actx = atlas.getContext('2d');
  if (!actx) return null;
  const out = actx.createImageData(aw, ah);
  kept.forEach((s, k) => {
    const m = shards.indexOf(s);
    const [ax, ay] = at[k]!;
    for (let y = s.y0; y <= s.y1; y++) {
      for (let x = s.x0; x <= s.x1; x++) {
        const i = y * cw + x;
        if (owner[i] !== m) continue;
        const o = ((ay + y - s.y0) * aw + ax + x - s.x0) * 4;
        const dark = seam[i] ? W.seamDark : 1;
        out.data[o] = rgba[i * 4]! * dark;
        out.data[o + 1] = rgba[i * 4 + 1]! * dark;
        out.data[o + 2] = rgba[i * 4 + 2]! * dark;
        out.data[o + 3] = rgba[i * 4 + 3]!;
      }
    }
  });
  actx.putImageData(out, 0, 0);

  const source = Texture.from(atlas).source;
  const def = ENTITIES[id];
  const scale = (def.size * VIEW.scalePerSize[def.category] * VIEW.refCell) / cw;
  const pieces = kept.map((s, k): Piece => {
    const [ax, ay] = at[k]!;
    const bw = s.x1 - s.x0 + 1;
    const bh = s.y1 - s.y0 + 1;
    return {
      tex: new Texture({ source, frame: new Rectangle(ax, ay, bw, bh) }),
      ox: (s.x0 + bw / 2 - pivot[0]) * scale,
      oy: (s.y0 + bh / 2 - pivot[1]) * scale,
      frac: s.area / total,
      scale,
      tint: 0xffffff,
    };
  });
  return { pieces, width: wreckWidth(id) };
}

/** Multiplica cada canal de un color por `k` (0–1). */
export function shade(color: number, k: number): number {
  const r = (((color >> 16) & 255) * k) | 0;
  const g = (((color >> 8) & 255) * k) | 0;
  const b = ((color & 255) * k) | 0;
  return (r << 16) | (g << 8) | b;
}

// Como la biblioteca de sprites, duran toda la app: una partida nueva no vuelve a recortar nada.
export const sets = new Map<EntityId, PieceSet>();
