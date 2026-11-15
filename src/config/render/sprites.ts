// Sprites, direcciones, vista de cámara, paleta, pantalla vieja y niebla de radiación.
import type { AnimId, Category } from '../entities';

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
    victory: 16,
  } satisfies Record<AnimId, number>,
  defaultFps: 12,
  /** Animaciones que se reproducen una vez. `death` se queda en el último frame (biblia §11.4). */
  oneShot: ['death', 'hit', 'attack', 'attack_1', 'attack_2', 'victory'] as readonly AnimId[],
  /** Corrige el pivote de un JSON sin tocar el archivo: { id: [x, y] } o { 'id_anim': [x, y] }. */
  // Las hojas viejas de Dot (prototipo) traen el pivote mal; las de idle y victory ya vienen bien.
  pivotOverride: { dot_run: [128, 213], dot_hit: [128, 213], dot_death: [128, 213] } as Readonly<
    Record<string, readonly [number, number]>
  >,
} as const;

export const VIEW = {
  /** Vista de referencia; la escala de cámara se ajusta para que quepa. */
  // DECISIÓN: vista más cerca (antes 1100×620, tope 1.4): personajes y enemigos se ven más grandes, como en otros
  // juegos del género; el radar compensa lo que se deja de ver.
  width: 820,
  height: 460,
  minScale: 0.45,
  maxScale: 2.4,
  /** Escala de la celda en pantalla = tamaño de la entidad × este valor. */
  scalePerSize: { characters: 0.32, enemies: 0.32, bosses: 0.14, props: 0.32 } satisfies Record<
    Category,
    number
  >,
  /** Lado de celda de las hojas para el que vale `scalePerSize`; una hoja de 384 px se dibuja a 256/384. */
  refCell: 256,
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
/**
 * Filtro de pantalla vieja de la run (ajuste «Filtro CRT»): curvatura del tubo, separación de rojo y azul en px de
 * pantalla (más hacia los bordes), intensidad de la banda de luz que baja y del parpadeo.
 */
export const OLD_SCREEN = { curve: 0.12, aberration: 3.2, roll: 0.07, flicker: 0.03 } as const;

/**
 * Niebla de radiación: desde `from` de RAD la pantalla se tiñe de verde nuclear y se cierra hacia el personaje; en
 * `full` solo queda un hueco de `hole` px de mundo alrededor de él (a 100 se muere). `lift` sube el centro del pie
 * al cuerpo.
 */
export const RAD_FOG = {
  from: 20,
  full: 95,
  color: 0x5cff1f,
  maxAlpha: 0.97,
  hole: 36,
  lift: 30,
  /** Fracción del radio del degradado que queda limpia; el resto sube suave hasta verde opaco. */
  soft: 0.3,
  /** Al empezar, el hueco limpio mide esta fracción de la media diagonal de la pantalla. */
  start: 0.55,
} as const;
