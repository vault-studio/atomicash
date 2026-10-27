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
