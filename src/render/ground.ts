// Suelo de baldosas de un mapa sin bordes: solo se colocan las casillas que ve la cámara, reciclando sprites.
// Cada casilla elige su baldosa con un hash de la semilla, así que el mismo sitio se ve siempre igual.
import { Assets, Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { HAZARDS } from '../config/radiation';
import { RUN_COLORS, TILES, type TileIndex, type TileInfo } from '../config/render';
import { RUN } from '../config/run';
import { cellRand, hazardAt } from '../engine/hazards';
import type { World } from '../engine/types';
import { isoX, isoY } from './iso';

const T = RUN.groundCell;
/** Casillas de más alrededor de la cámara, para que no se vea el borde al moverse. */
const MARGIN = 2;
const ISO = Math.SQRT1_2;

interface GroundTile {
  readonly tex: Texture;
  readonly head: number;
  /** Lo que sobresale, para ordenarlo con los personajes. */
  readonly top: Texture | null;
  readonly acid: number;
  readonly weight: number;
}

export interface GroundTiles {
  readonly sand: readonly GroundTile[];
  readonly deco: readonly GroundTile[];
  /** Lagos de ácido, de menor a mayor. */
  readonly acid: readonly GroundTile[];
}

/** Carga `tiles.json` y sus texturas; las que fallen se saltan. */
export async function loadGroundTiles(): Promise<GroundTiles> {
  const index = await Assets.load<TileIndex>(TILES.index);
  const load = async (set: readonly TileInfo[], weights?: readonly number[]): Promise<GroundTile[]> => {
    const out = await Promise.all(
      set.map(async (t, i) => {
        try {
          const [tex, top] = await Promise.all([
            Assets.load<Texture>(TILES.dir + t.file),
            t.top ? Assets.load<Texture>(TILES.dir + t.top) : Promise.resolve(null),
          ]);
          return { tex, top, head: t.head, acid: t.acid ?? 0, weight: weights?.[i] ?? 1 };
        } catch {
          return null;
        }
      }),
    );
    return out.filter((t) => t !== null && t.weight > 0) as GroundTile[];
  };
  const [sand, ...decoSets] = await Promise.all([
    load(index.sets[TILES.sand] ?? [], TILES.sandWeights),
    ...TILES.deco.map((name) => load(index.sets[name] ?? [])),
  ]);
  const deco = decoSets.flat();
  return {
    sand: (sand ?? []).filter((t) => t.acid === 0),
    deco: deco.filter((t) => t.acid === 0),
    acid: [...(sand ?? []), ...deco].filter((t) => t.acid > 0).sort((x, y) => x.acid - y.acid),
  };
}

/**
 * Arena casi siempre, decoración de vez en cuando y lago de ácido, del tamaño del charco, en las casillas con charco
 * radiactivo. Lo que sobresale de una baldosa (árbol, poste, señales) va a la capa de actores, ordenado por
 * profundidad, para que los personajes puedan pasar por detrás.
 */
export class GroundView {
  readonly layer = new Container();
  /** Charco dibujado a mano, solo si faltan las baldosas del lago. */
  readonly outlines = new Graphics();
  private readonly sprites: Sprite[] = [];
  private readonly tops: Sprite[] = [];
  private used = 0;
  private usedTops = 0;
  private key = '';
  private readonly scale = ((T * Math.SQRT2) / TILES.imageWidth) * TILES.overlap;
  private readonly sandTotal: number;

  constructor(
    private readonly tiles: GroundTiles | null,
    private readonly actors: Container,
    private readonly world: World,
  ) {
    this.sandTotal = tiles ? tiles.sand.reduce((a, t) => a + t.weight, 0) : 0;
  }

  /** Coloca las casillas que caen dentro de la cámara (centro en mundo y semiextensión en px isométricos). */
  update(cx: number, cy: number, halfW: number, halfH: number): void {
    const sx = isoX(cx, cy);
    const sy = isoY(cx, cy);
    let i0 = Infinity;
    let i1 = -Infinity;
    let j0 = Infinity;
    let j1 = -Infinity;
    // Esquinas de la pantalla de vuelta a mundo: x − y = sx/ISO, x + y = 2·sy/ISO.
    for (const [ex, ey] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const) {
      const a = (sx + ex * halfW) / ISO;
      const b = (2 * (sy + ey * halfH)) / ISO;
      const i = Math.floor((a + b) / 2 / T);
      const j = Math.floor((b - a) / 2 / T);
      i0 = Math.min(i0, i);
      i1 = Math.max(i1, i);
      j0 = Math.min(j0, j);
      j1 = Math.max(j1, j);
    }
    i0 -= MARGIN;
    j0 -= MARGIN;
    i1 += MARGIN;
    j1 += MARGIN;
    const key = `${i0},${i1},${j0},${j1}`;
    if (key === this.key) return;
    this.key = key;
    this.rebuild(i0, i1, j0, j1, sx, sy, halfW + T * 2, halfH + T * 2);
  }

  private rebuild(
    i0: number,
    i1: number,
    j0: number,
    j1: number,
    sx: number,
    sy: number,
    hw: number,
    hh: number,
  ): void {
    const { seed, start } = this.world;
    this.used = 0;
    this.usedTops = 0;
    this.outlines.clear();
    const painted = this.tiles !== null && this.tiles.acid.length > 0;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const wx = (i + 0.5) * T;
        const wy = (j + 0.5) * T;
        const x = isoX(wx, wy);
        const y = isoY(wx, wy);
        // El rectángulo de casillas es un rombo en pantalla: se saltan las que quedan fuera.
        if (Math.abs(x - sx) > hw || Math.abs(y - sy) > hh) continue;
        const hz = hazardAt(seed, i, j, start.x, start.y);
        // DECISIÓN: con el lago pintado no se marca el borde; solo se dibuja el charco si faltan las baldosas.
        if (hz >= 0 && !painted) {
          const r = T * HAZARDS.cellRadii[hz]!;
          this.outlines
            .ellipse(x, y, r, r / 2)
            .fill({ color: RUN_COLORS.hazard, alpha: RUN_COLORS.hazardAlpha })
            .stroke({ width: 2, color: RUN_COLORS.hazard, alpha: 0.35 });
        }
        const t = this.pick(i, j, hz);
        if (!t) continue;
        this.place(this.sprite(), t, t.tex, x, y);
        if (t.top) {
          const top = this.place(this.topSprite(), t, t.top, x, y);
          top.zIndex = wx + wy;
        }
      }
    }
    for (let k = this.used; k < this.sprites.length; k++) this.sprites[k]!.visible = false;
    for (let k = this.usedTops; k < this.tops.length; k++) this.tops[k]!.visible = false;
  }

  private pick(i: number, j: number, hz: number): GroundTile | undefined {
    const tiles = this.tiles;
    if (!tiles || tiles.sand.length === 0) return undefined;
    const seed = this.world.seed;
    if (hz >= 0 && tiles.acid.length > 0) {
      // El índice del radio entre los posibles elige el lago, de menor a mayor.
      const f = hz / Math.max(1, HAZARDS.cellRadii.length - 1);
      return tiles.acid[Math.round(f * (tiles.acid.length - 1))];
    }
    if (tiles.deco.length > 0 && cellRand(seed, i, j, 3) < TILES.decoChance)
      return tiles.deco[Math.floor(cellRand(seed, i, j, 4) * tiles.deco.length)];
    let r = cellRand(seed, i, j, 5) * this.sandTotal;
    let k = 0;
    while (k < tiles.sand.length - 1 && r >= tiles.sand[k]!.weight) r -= tiles.sand[k++]!.weight;
    return tiles.sand[k];
  }

  private sprite(): Sprite {
    let s = this.sprites[this.used];
    if (!s) {
      s = new Sprite();
      s.tint = TILES.tint;
      this.sprites.push(s);
      this.layer.addChild(s);
    }
    this.used++;
    return s;
  }

  private topSprite(): Sprite {
    let s = this.tops[this.usedTops];
    if (!s) {
      s = new Sprite();
      s.tint = TILES.tint;
      this.tops.push(s);
      this.actors.addChild(s);
    }
    this.usedTops++;
    return s;
  }

  private place(s: Sprite, t: GroundTile, tex: Texture, x: number, y: number): Sprite {
    s.texture = tex;
    // El centro del rombo, no el de la imagen: la parte de arriba es lo que sobresale.
    // DECISIÓN: sin espejo al azar; las ondas de la arena van todas en el mismo sentido y se ven más naturales.
    s.anchor.set(0.5, (t.head + (tex.height - t.head) / 2) / tex.height);
    s.scale.set(this.scale);
    s.position.set(x, y);
    s.visible = true;
    return s;
  }
}
