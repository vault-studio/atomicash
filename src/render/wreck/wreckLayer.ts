// Restos de robots: el sprite de cada uno se parte en trozos irregulares que salen volando y se quedan en el suelo.
// DECISIÓN: los trozos se recortan del propio sprite al empezar la partida, así un robot nuevo no necesita arte aparte,
// y las piezas salen de una sola dirección de la hoja: la explosión tapa el cambio.
import { Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { ELITES, ENEMY_STATS, type EnemyStats } from '../config/enemies';
import { ENTITIES, type EntityId } from '../config/entities';
import { FX_ART, VIEW } from '../config/render';
import type { World } from '../engine/types';
import { flyLift } from './fxLayer';
import { isoX, isoY } from './iso';
import type { SpriteLibrary } from './sprites';
import { pieceAt, shatter, wreckRand, wreckWidth, type PieceState, type Shard } from './wreckMath';

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

interface PieceSet {
  readonly pieces: readonly Piece[];
  readonly width: number;
}

const W = FX_ART.wreck;
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
function colorPieces(id: EntityId): PieceSet {
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

function spritePieces(lib: SpriteLibrary, id: EntityId): PieceSet | null {
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
function shade(color: number, k: number): number {
  const r = (((color >> 16) & 255) * k) | 0;
  const g = (((color >> 8) & 255) * k) | 0;
  const b = ((color & 255) * k) | 0;
  return (r << 16) | (g << 8) | b;
}

// Como la biblioteca de sprites, duran toda la app: una partida nueva no vuelve a recortar nada.
const sets = new Map<EntityId, PieceSet>();

export class WreckLayer {
  /** Lo que ya ha caído (bajo los actores) y lo que aún vuela (encima). */
  readonly ground = new Container();
  readonly air = new Container();
  private readonly sprites: Sprite[] = [];
  private readonly state: PieceState = { x: 0, y: 0, z: 0, rot: 0, f: 0 };

  /** Recorta aquí todos los robots: hacerlo en la primera baja daría un tirón en plena partida. */
  constructor(private readonly lib: SpriteLibrary) {
    for (const [id, s] of Object.entries(ENEMY_STATS) as [EntityId, EnemyStats][]) if (s.wreck) this.set(id);
  }

  private set(id: EntityId): PieceSet {
    let s = sets.get(id);
    if (!s) {
      s = spritePieces(this.lib, id) ?? colorPieces(id);
      sets.set(id, s);
    }
    return s;
  }

  private sprite(i: number): Sprite {
    let s = this.sprites[i];
    if (!s) {
      s = new Sprite();
      s.anchor.set(0.5);
      this.sprites[i] = s;
    }
    s.visible = true;
    return s;
  }

  sync(w: World): void {
    let n = 0;
    const P = this.state;
    for (let i = 0; i < w.wrecks.count; i++) {
      const k = w.wrecks.items[i]!;
      const age = w.time - k.t;
      if (age < W.delay) continue;
      const set = this.set(k.sprite);
      const size = k.elite ? ELITES.scale : 1;
      const width = set.width * size;
      const lift = k.flying ? flyLift(k.sprite) : 0;
      const alpha = Math.min(1, (k.until - w.time) / W.fade);
      const dark = 1 - (1 - W.char) * Math.min(1, age / W.charTime);
      const sx = isoX(k.x, k.y);
      const sy = isoY(k.x, k.y);
      for (let j = 0; j < set.pieces.length; j++) {
        const p = set.pieces[j]!;
        pieceAt(P, k.seed, j, p.ox * size, p.oy * size, p.frac, width, lift, age, W.motion);
        const s = this.sprite(n++);
        s.texture = p.tex;
        s.scale.set(p.scale * size * (1 - (1 - W.restScale) * P.f));
        s.position.set(sx + P.x, sy + P.y - P.z);
        s.rotation = P.rot;
        s.alpha = alpha;
        s.tint = shade(p.tint, dark);
        const layer = P.f < 1 ? this.air : this.ground;
        if (s.parent !== layer) layer.addChild(s);
      }
    }
    for (let i = n; i < this.sprites.length; i++) this.sprites[i]!.visible = false;
  }
}
