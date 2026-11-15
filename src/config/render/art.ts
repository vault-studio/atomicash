// Baldosas del suelo y arte de los objetos del mapa.
import type { ActId } from '../acts';

/**
 * Baldosas de suelo recortadas de las láminas de ARTE/ con tools/slice_tiles.py (rombo
 * 2:1 de 256×128). `tiles.json` dice qué baldosa lleva lago de ácido, cuánto sobresale por arriba y si lo que
 * sobresale va aparte (`top`) para ordenarlo con los personajes.
 * DECISIÓN: el suelo es una sola lámina de arena con dos lagos de ácido (grande y pequeño). Casi todo es arena, sobre
 * todo la lisa sin matojos (deja leer bien personajes y proyectiles), y los lagos solo salen donde hay charco
 * radiactivo: el verde en el suelo siempre significa daño. La decoración irá encima como objetos sin baldosa.
 */
export const TILES = {
  dir: 'assets/tiles/',
  index: 'assets/tiles/tiles.json',
  /** Lámina de la que sale el lago que deja la nevera, en cualquier acto. */
  iceLake: 'hielo',
  /**
   * Por acto: lámina del suelo, peso de cada baldosa y tinte, que oscurece el suelo y los objetos para que destaquen
   * los personajes. Todas las láminas tienen la misma rejilla: la 1 y la 4 son lisas, la 0 y la 3 llevan matojos, y
   * la 2 y la 5 son los lagos (ácido en el acto 1).
   * DECISIÓN: en los actos 2 y 3 los matojos destacan más que en la arena y salen la mitad de veces.
   */
  acts: {
    1: { sand: 'suelo', weights: [1, 6, 1, 1, 6, 1], tint: 0xb8a890 },
    2: { sand: 'hielo', weights: [1, 12, 1, 1, 12, 1], tint: 0xc0c8d4 },
    3: { sand: 'plantas', weights: [1, 12, 1, 1, 12, 1], tint: 0xb8b8a0 },
  } as Readonly<
    Record<ActId, { readonly sand: string; readonly weights: readonly number[]; readonly tint: number }>
  >,
  /** Baldosas de suelo roto, debajo de los escombros (tools/slice_destrozos.py). */
  broken: 'roto',
  /** Láminas de decoración con baldosa; sus baldosas con ácido también son lagos. */
  deco: [] as readonly string[],
  /** Probabilidad de que una casilla sin charco lleve decoración. */
  decoChance: 0.07,
  /** Objetos sueltos (sin baldosa) de tools/slice_props.py; qué hay y dónde, en config/props.ts. */
  propsDir: 'assets/props/',
  /** Ancho del rombo en la imagen, en px. */
  imageWidth: 256,
  /** El suelo roto y los escombros ya vienen oscuros: con el tinte del acto se confundirían entre ellos. */
  brokenTint: 0xdccab0,
  rubbleTint: 0xffffff,
  /** Solape para que no se vean costuras. */
  overlap: 1.03,
} as const;

/** Lo que escribe tools/slice_tiles.py en `tiles.json`. */
export interface TileInfo {
  readonly file: string;
  /** Px de la imagen por encima del rombo (objetos que sobresalen). */
  readonly head: number;
  /** Fracción de la cara cubierta de ácido, si la hay. */
  readonly acid?: number;
  /** Lo que sobresale, aparte, en el mismo lienzo que `file`. */
  readonly top?: string;
}

export interface TileIndex {
  readonly width: number;
  readonly height: number;
  readonly sets: Readonly<Record<string, readonly TileInfo[]>>;
}

/**
 * Dibujos de los objetos del mapa (tools/slice_pickups.py → `assets/pickups/`). `w` es el ancho del cuerpo en px de
 * mundo como múltiplo del radio del objeto (`fixed`: en px, para los que no tienen radio propio). `bob`: flota.
 * DECISIÓN: algo más grandes que su radio de recogida para que se lean entre la arena y los enemigos.
 */
export const PICKUP_ART = {
  dir: 'assets/pickups/',
  index: 'assets/pickups/pickups.json',
  w: {
    gem1: 2.8,
    gem5: 2.8,
    gem25: 4,
    stim: 3.6,
    coupon: 4.4,
    crate: 2.1,
    chest: 2.3,
    cache: 1.7,
    medkit: 3.2,
    magnet: 3,
    bomb: 2.8,
    freeze: 2.4,
    nuka: 2.4,
    boots: 3,
    barrel: 1.7,
    barrel_lit: 2.2,
  } as Readonly<Record<string, number>>,
  fixed: { beacon: 46 } as Readonly<Record<string, number>>,
  /** Petardos de la ristra: ancho, altura del arco, altura de salida (la mano) y vueltas en el aire, en radianes. */
  mine: { w: 18, arc: 70, lift: 22, spin: 9 },
  bob: [
    'stim',
    'coupon',
    'medkit',
    'magnet',
    'bomb',
    'freeze',
    'nuka',
    'boots',
    'chest',
    'crate',
    'cache',
  ] as readonly string[],
} as const;

export interface AuraArt {
  readonly strip: string;
  readonly ring: number;
  readonly ax: number;
  readonly ay: number;
  readonly fps: number;
  readonly alpha: number;
}
