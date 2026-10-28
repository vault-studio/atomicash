// Parámetros de render y contrato de sprite sheets (biblia de arte §4).
import type { AnimId, Category } from './entities';

export const DIRECTIONS = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE'] as const;
/** Alias en español que algunos JSON pueden traer (S, SO, O, NO…). */
export const DIRECTIONS_ES = ['S', 'SO', 'O', 'NO', 'N', 'NE', 'E', 'SE'] as const;
export type Direction = (typeof DIRECTIONS)[number];

export const SPRITES = {
  /** Base de la carpeta de arte, relativa a la URL de la app. */
  assetBase: 'assets/',
  manifest: 'manifest.json',
  /** Celda por categoría: 256 personajes/enemigos, 512 jefes. */
  cell: { characters: 256, enemies: 256, bosses: 512, props: 256 } satisfies Record<Category, number>,
  /** Pivote en los pies como fracción de la celda: (128, 200) en 256 y (256, 400) en 512. */
  pivotFrac: [0.5, 200 / 256] as const,
  /** Frames por defecto si el JSON no los trae (el código los lee del JSON; esto es solo respaldo). */
  defaultFrames: {
    idle: 8,
    run: 12,
    move: 12,
    attack: 8,
    attack_1: 8,
    attack_2: 8,
    hit: 4,
    death: 12,
  } satisfies Record<AnimId, number>,
  defaultFps: 12,
  /** Animaciones que se reproducen una vez. `death` se queda en el último frame (biblia §11.4). */
  oneShot: ['death', 'hit', 'attack', 'attack_1', 'attack_2'] as readonly AnimId[],
  /** Corrige el pivote de un JSON sin tocar el archivo: { id: [x, y] } o { 'id_anim': [x, y] }. */
  pivotOverride: { dot: [128, 213] } as Readonly<Record<string, readonly [number, number]>>,
} as const;

export const VIEW = {
  /** Vista de referencia; la escala de cámara se ajusta para que quepa. */
  width: 1100,
  height: 620,
  minScale: 0.45,
  maxScale: 1.4,
  /** Escala de la celda en pantalla = tamaño de la entidad × este valor. */
  scalePerSize: { characters: 0.32, enemies: 0.32, bosses: 0.14, props: 0.32 } satisfies Record<
    Category,
    number
  >,
  /** Radio del placeholder = tamaño × este valor (en px de mundo). */
  placeholderRadiusPerSize: 10,
  gridStep: 100,
} as const;

/** Paleta base (04_ART_UI.md §1) más colores del suelo del prototipo. */
export const PALETTE = {
  background: 0x16140f,
  ground: 0x2a261c,
  mapEdge: 0x8a3324,
  grid: 0xfff0c8,
  gridAlpha: 0.05,
  cream: 0xf3e9d2,
  crt: 0x3cff6b,
  shadow: 0x000000,
} as const;

/**
 * Radar del HUD: recogibles y cajas de alrededor, cada tipo con su color; lo que queda fuera del alcance se marca
 * con una flecha en el borde. Alcance en px isométricos de pantalla (la vista de referencia mide 1280 de ancho).
 */
export const RADAR = {
  range: 1500,
  /** Lado del radar en px CSS (el HUD lo encoge en pantallas bajas). */
  size: 176,
  /** Vueltas por segundo del barrido. */
  sweep: 0.35,
  phosphor: '#3cff6b',
  dim: 'rgba(60, 255, 107, 0.28)',
  bg: 'rgba(6, 20, 9, 0.88)',
  kinds: {
    medkit: '#ff4d4d',
    magnet: '#4db8ff',
    bomb: '#ff9a2e',
    crate: '#ffe14a',
    chest: '#c77dff',
  } as Readonly<Record<'medkit' | 'magnet' | 'bomb' | 'crate' | 'chest', string>>,
} as const;

/** Colores de la run (placeholders de proyectiles, chatarra, charcos…). */
export const RUN_COLORS = {
  gem: { 1: 0xe8d36a, 5: 0x6ad8e8, 25: 0xff8ad8 } as Readonly<Record<number, number>>,
  gemBig: 0xff8ad8,
  stim: 0xff5577,
  chest: 0xd8a53a,
  crate: 0x8a7a4a,
  medkit: 0xf2efe6,
  medkitCross: 0xd8322e,
  magnet: 0xd8322e,
  magnetTip: 0xc8ccd0,
  bomb: 0x2a2a2a,
  bombFuse: 0xffb347,
  hazard: 0x9dff00,
  hazardAlpha: 0.18,
  slime: 0x7dff3a,
  pool: 0xff7a2a,
  tele: 0xff3c28,
  mine: 0xff5a5a,
  ebullet: 0xff6a3a,
  shadow: 0x000000,
  irradiated: 0xa8ff70,
  flash: 0xffb0b0,
  rain: 0x9dff00,
  storm: 0x8a3324,
  aura: 0x7dff6a,
  text: {
    dmg: 0xeeeeee,
    crit: 0xffe14a,
    hurt: 0xff6050,
    dodge: 0x99ccff,
    pickup: 0xffffff,
    slogan: 0xd6b0ff,
  },
} as const;

/**
 * Baldosas de suelo recortadas de las láminas de ARTE/ (arena y dos de decoración) con tools/slice_tiles.py (rombo
 * 2:1 de 256×128). `tiles.json` dice qué baldosa lleva lago de ácido, cuánto sobresale por arriba y si lo que
 * sobresale va aparte (`top`) para ordenarlo con los personajes.
 * DECISIÓN: casi todo es arena, sobre todo la lisa sin matojos (deja leer bien personajes y proyectiles); la
 * decoración (poste, trinchera, bidones, valla, barrera, señales, árbol, surtidor, coche) sale en una de cada ~14
 * casillas, y los lagos de ácido solo donde hay charco radiactivo: el verde en el suelo siempre significa daño.
 */
export const TILES = {
  dir: 'assets/tiles/',
  index: 'assets/tiles/tiles.json',
  /** Lámina de arena y peso de cada una de sus baldosas (la 1 y la 4 son arena lisa). */
  sand: 'arena',
  sandWeights: [1, 6, 1, 1, 6, 1] as readonly number[],
  /** Láminas de decoración; sus baldosas con ácido son los lagos. */
  deco: ['deco_a', 'deco_b'] as readonly string[],
  /** Probabilidad de que una casilla sin charco lleve decoración. */
  decoChance: 0.07,
  /** Ancho del rombo en la imagen, en px. */
  imageWidth: 256,
  /** Oscurece el suelo para que destaquen los personajes. */
  tint: 0xb8a890,
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
