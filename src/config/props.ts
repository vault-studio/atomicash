// Objetos sueltos encima de la arena (bidones, coches, edificios…): el render los pinta y el motor los usa como
// obstáculos. `props.json` lo escribe tools/slice_props.py; el orden de su lista es el índice de cada objeto.
import index from '../../assets/props/props.json';
import type { StatEnemyId } from './enemies';
import { RUN } from './run';

const T = RUN.groundCell;

export const PROPS = {
  /**
   * Probabilidad, por casilla, de que empiece en ella un objeto de 1, 2 o 4 casillas. Los de 2 y 4 se deciden por
   * bloques de 2×2 casillas (×4), para que no se pisen.
   */
  chance1: 0.02,
  chance2: 0.01,
  chance4: 0.005,
  /**
   * Escala de los objetos de una casilla respecto a las baldosas; los de varias ya vienen al tamaño de su huella.
   * DECISIÓN: a la escala de la lámina un contenedor doblaba al personaje; a la mitad queda un bidón por la cintura.
   */
  scale: 0.5,
  /** Radio de choque en fracción de la mitad del ancho de la base: algo menos, para no chocar con el aire. */
  hit: 0.8,
  /** Medio grosor de los de 2 casillas, en fracción de la casilla. */
  longR: 0.25,
  /** Los de 2×2: medio lado del núcleo y redondeo, en fracción de la casilla (llega a 0,8 de cada lado). */
  bigHalf: 0.65,
  bigR: 0.15,
  /** Solape de las baldosas (TILES.overlap): los objetos se escalan igual que el suelo. */
  overlap: 1.03,
  /** Ancho del rombo de una baldosa en la imagen, en px. */
  tileWidth: 256,
} as const;

export type BuildingKind = 'raiders' | 'robots' | 'necro' | 'supply';

/** Edificios de 2×2 (por archivo) y lo que los rodea la primera vez que el jugador se acerca. */
export const BUILDINGS = {
  byFile: {
    'big_00.png': 'raiders',
    'big_01.png': 'robots',
    'big_02.png': 'supply',
    'big_03.png': 'necro',
  } as Readonly<Record<string, BuildingKind>>,
  /** Distancia del jugador al centro a la que aparece la guarnición (por debajo de SPAWN.relocateDist). */
  trigger: 1000,
  /** Anillo alrededor del centro donde aparecen (el núcleo llega a 0,8 casillas). */
  ring: 1.4 * T,
  jitter: 0.3 * T,
  enemies: {
    raiders: [
      ['saqueador', 4],
      ['tirador', 2],
    ],
    robots: [
      ['dron', 3],
      ['aspiradora', 1],
      ['cortacesped', 1],
      ['torreta', 1],
    ],
    necro: [['necrofago', 8]],
    supply: [],
  } as Readonly<Record<BuildingKind, readonly (readonly [StatEnemyId, number])[]>>,
  /** Cajas de suministros alrededor del supermercado: entre min y max. */
  crates: { min: 3, max: 4 },
} as const;

/** Lo que escribe tools/slice_props.py en `props.json`. */
export interface PropInfo {
  readonly file: string;
  /** Casillas que ocupa: 1, 2 en fila (eje x del mundo) o 4 (2×2). */
  readonly cells: number;
  /** Punto de apoyo (centro de la huella), en fracción del ancho y del alto de la imagen. */
  readonly ax: number;
  readonly ay: number;
  /** Ancho de la base, en px de baldosa. */
  readonly fw: number;
}

/** Forma de choque: caja de semilados (hx, hy) alrededor del centro de la huella, redondeada con radio r. */
export interface PropShape {
  readonly hx: number;
  readonly hy: number;
  readonly r: number;
}

export const PROP_LIST: readonly PropInfo[] = index.props;

const indicesWith = (cells: number): number[] =>
  PROP_LIST.flatMap((p, k) => (p.cells === cells ? [k] : []));
export const PROPS_BY_CELLS = { 1: indicesWith(1), 2: indicesWith(2), 4: indicesWith(4) } as const;

/** Escala de cada objeto respecto a una baldosa. */
export const PROP_SCALE: readonly number[] = PROP_LIST.map((p) => (p.cells === 1 ? PROPS.scale : 1));

/** Tipo de edificio de cada objeto, o null si no es edificio. */
export const PROP_BUILDING: readonly (BuildingKind | null)[] = PROP_LIST.map((p) => BUILDINGS.byFile[p.file] ?? null);

/**
 * Forma de choque de cada objeto en unidades de mundo. Para los de una casilla, un círculo: un círculo de radio r
 * se ve en isométrico con 2r de ancho y una casilla de lado T con T·√2, así que la base (fw px de 256) mide
 * fw/256 · T·√2 · overlap · escala.
 */
export const PROP_SHAPES: readonly PropShape[] = PROP_LIST.map((p, k) => {
  if (p.cells === 2) return { hx: T / 2, hy: 0, r: T * PROPS.longR };
  if (p.cells === 4) return { hx: T * PROPS.bigHalf, hy: T * PROPS.bigHalf, r: T * PROPS.bigR };
  const r = ((p.fw / PROPS.tileWidth) * T * Math.SQRT2 * PROPS.overlap * PROP_SCALE[k]! * PROPS.hit) / 2;
  return { hx: 0, hy: 0, r };
});
