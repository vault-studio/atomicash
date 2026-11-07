// Suelo de baldosas de un mapa sin bordes: solo se colocan las casillas que ve la cámara, reciclando sprites.
// Cada casilla elige su baldosa con un hash de la semilla, así que el mismo sitio se ve siempre igual.
import { Assets, Container, Graphics, Sprite, type Texture } from 'pixi.js';
import type { ActId } from '../config/acts';
import { AI } from '../config/enemies';
import { HAZARDS } from '../config/radiation';
import { PROP_LIST, PROP_SCALE, RUBBLE_PROPS } from '../config/props';
import { RUN_COLORS, TILES, type TileIndex, type TileInfo } from '../config/render';
import { RUN } from '../config/run';
import { cellKey, cellRand, worldHazardAt } from '../engine/hazards';
import { createCellObject, worldObjectAt } from '../engine/obstacles';
import type { World } from '../engine/types';
import { isoX, isoY } from './iso';

const T = RUN.groundCell;
/** Casillas de más alrededor de la cámara, para que no se vea el borde al moverse. */
const MARGIN = 2;
const ISO = Math.SQRT1_2;
const cell = createCellObject();

interface GroundTile {
  readonly tex: Texture;
  readonly head: number;
  /** Lo que sobresale, para ordenarlo con los personajes. */
  readonly top: Texture | null;
  readonly acid: number;
  readonly weight: number;
}

interface Prop {
  readonly tex: Texture;
  readonly ax: number;
  readonly ay: number;
}

export interface GroundTiles {
  readonly sand: readonly GroundTile[];
  readonly deco: readonly GroundTile[];
  /** Lagos de ácido, de menor a mayor. */
  readonly acid: readonly GroundTile[];
  /** Suelo roto bajo los escombros. */
  readonly broken: readonly GroundTile[];
  /** Lago de hielo que deja la nevera; null si no cargó. */
  readonly ice: GroundTile | null;
  /** Objetos sueltos que van encima de la arena, en el orden de `PROP_LIST`; null si no cargó o es de otro acto. */
  readonly props: readonly (Prop | null)[];
}

/** Carga las texturas de los objetos del acto; las que fallen quedan a null (el obstáculo sigue estando). */
function loadProps(act: ActId): Promise<(Prop | null)[]> {
  return Promise.all(
    PROP_LIST.map(async (p, k) => {
      if ((p.act ?? 1) !== act && !RUBBLE_PROPS.includes(k)) return null;
      try {
        return { tex: await Assets.load<Texture>(TILES.propsDir + p.file), ax: p.ax, ay: p.ay };
      } catch {
        return null;
      }
    }),
  );
}

/** Carga `tiles.json` y las texturas del acto; las que fallen se saltan. */
export async function loadGroundTiles(act: ActId): Promise<GroundTiles> {
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
  const [props, broken, sand, frost, ...decoSets] = await Promise.all([
    loadProps(act),
    load(index.sets[TILES.broken] ?? []),
    load(index.sets[TILES.acts[act].sand] ?? [], TILES.acts[act].weights),
    load(index.sets[TILES.iceLake] ?? []),
    ...TILES.deco.map((name) => load(index.sets[name] ?? [])),
  ]);
  const deco = decoSets.flat();
  return {
    sand: (sand ?? []).filter((t) => t.acid === 0),
    deco: deco.filter((t) => t.acid === 0),
    acid: [...(sand ?? []), ...deco].filter((t) => t.acid > 0).sort((x, y) => x.acid - y.acid),
    broken: broken ?? [],
    // El lago más pequeño del bioma de hielo: lo que deja la nevera, en cualquier acto.
    ice: frost?.filter((t) => t.acid > 0).sort((x, y) => x.acid - y.acid)[0] ?? null,
    props,
  };
}

/**
 * Arena casi siempre, decoración de vez en cuando y lago de ácido, del tamaño del charco, en las casillas con charco
 * radiactivo. Lo que sobresale de una baldosa y los objetos sueltos que van encima de la arena (nunca del ácido) van
 * a la capa de actores, ordenados por profundidad, para que los personajes puedan pasar por detrás.
 */
export class GroundView {
  readonly layer = new Container();
  /** Charco dibujado a mano, solo si faltan las baldosas del lago. */
  readonly outlines = new Graphics();
  /** Suelo roto: encima de las baldosas, porque sus bordes pisan a las vecinas. */
  private readonly craters = new Container();
  private readonly sprites: Sprite[] = [];
  private readonly tops: Sprite[] = [];
  private readonly broken: Sprite[] = [];
  private used = 0;
  private usedTops = 0;
  private usedBroken = 0;
  private key = '';
  private readonly scale = ((T * Math.SQRT2) / TILES.imageWidth) * TILES.overlap;
  private readonly sandTotal: number;
  private readonly tint: number;

  constructor(
    private readonly tiles: GroundTiles | null,
    private readonly actors: Container,
    private readonly world: World,
  ) {
    this.sandTotal = tiles ? tiles.sand.reduce((a, t) => a + t.weight, 0) : 0;
    this.tint = TILES.acts[world.act].tint;
    this.layer.sortableChildren = true;
    this.craters.zIndex = 1;
    this.layer.addChild(this.craters);
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
    const key = `${i0},${i1},${j0},${j1},${this.world.scars.size}`;
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
    const w = this.world;
    this.used = 0;
    this.usedTops = 0;
    this.usedBroken = 0;
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
        const hz = worldHazardAt(w, i, j);
        // DECISIÓN: con el lago pintado no se marca el borde; solo se dibuja el charco si faltan las baldosas.
        if (hz >= 0 && !painted) {
          const r = T * HAZARDS.cellRadii[hz]!;
          this.outlines
            .ellipse(x, y, r, r / 2)
            .fill({ color: RUN_COLORS.hazard, alpha: RUN_COLORS.hazardAlpha })
            .stroke({ width: 2, color: RUN_COLORS.hazard, alpha: 0.35 });
        }
        // Mancha de hielo de la nevera: si no cargó el lago de hielo, una elipse azul pálida.
        const ice = w.scars.get(cellKey(i, j))?.kind === 'ice';
        if (ice && !this.tiles?.ice) {
          const I = RUN_COLORS.ice;
          const ir = T * AI.nevera.iceR;
          this.outlines
            .ellipse(x, y, ir, ir / 2)
            .fill({ color: I.color, alpha: I.alpha })
            .stroke({ width: 2, color: I.edge, alpha: 0.7 });
        }
        const t = (ice ? this.tiles?.ice : undefined) ?? this.pick(i, j, hz);
        if (!t) continue;
        this.place(this.sprite(), t, t.tex, x, y);
        if (t.top) {
          const top = this.place(this.topSprite(), t, t.top, x, y);
          top.zIndex = wx + wy;
        }
        // Los objetos de varias casillas se pintan una vez, desde su casilla de arriba a la izquierda.
        const has = worldObjectAt(w, i, j, cell) && cell.i === i && cell.j === j;
        if (has && w.scars.has(cellKey(i, j))) this.crater(i, j, x, y);
        const prop = has ? this.tiles?.props[cell.prop] : undefined;
        if (prop) {
          const s = this.topSprite();
          s.texture = prop.tex;
          s.anchor.set(prop.ax, prop.ay);
          s.scale.set(this.scale * PROP_SCALE[cell.prop]!);
          s.position.set(isoX(cell.x, cell.y), isoY(cell.x, cell.y));
          s.tint = w.scars.has(cellKey(i, j)) ? TILES.rubbleTint : this.tint;
          s.visible = true;
          s.zIndex = cell.x + cell.y;
        }
      }
    }
    for (let k = this.used; k < this.sprites.length; k++) this.sprites[k]!.visible = false;
    for (let k = this.usedTops; k < this.tops.length; k++) this.tops[k]!.visible = false;
    for (let k = this.usedBroken; k < this.broken.length; k++) this.broken[k]!.visible = false;
  }

  /** Suelo roto bajo los escombros, centrado en su casilla; sin baldosas, una mancha oscura con grietas. */
  private crater(i: number, j: number, cx: number, cy: number): void {
    const list = this.tiles?.broken;
    if (list && list.length > 0) {
      const t = list[Math.floor(cellRand(this.world.seed, i, j, 14) * list.length)]!;
      this.place(this.brokenSprite(), t, t.tex, cx, cy);
      return;
    }
    const C = RUN_COLORS.crater;
    const x = isoX(cell.x, cell.y);
    const y = isoY(cell.x, cell.y);
    const o = this.outlines;
    // Cada grieta con su tamaño y su giro, para que no salgan todas iguales.
    const size = C.r * (1 - C.vary + 2 * C.vary * cellRand(this.world.seed, i, j, 14));
    const turn = cellRand(this.world.seed, i, j, 15) * Math.PI * 2;
    o.ellipse(x, y, size, size / 2).fill({ color: C.color, alpha: C.alpha });
    for (let k = 0; k < C.cracks; k++) {
      const a = (k / C.cracks) * Math.PI * 2 + turn;
      const r = size * C.reach * (k % 2 === 0 ? 1 : C.short);
      o.moveTo(x, y).lineTo(x + Math.cos(a) * r, y + (Math.sin(a) * r) / 2);
    }
    o.stroke({ width: C.width, color: C.color, alpha: C.alpha });
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
      s.tint = this.tint;
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
      this.tops.push(s);
      this.actors.addChild(s);
    }
    s.tint = this.tint;
    this.usedTops++;
    return s;
  }

  private brokenSprite(): Sprite {
    let s = this.broken[this.usedBroken];
    if (!s) {
      s = new Sprite();
      s.tint = TILES.brokenTint;
      this.broken.push(s);
      this.craters.addChild(s);
    }
    this.usedBroken++;
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
