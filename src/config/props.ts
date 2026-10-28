// Objetos sueltos encima de la arena (bidones, rocas, contenedores…): el render los pinta y el motor los usa como
// obstáculos. `props.json` lo escribe tools/slice_props.py; el orden de su lista es el índice de cada objeto.
import index from '../../assets/props/props.json';
import { RUN } from './run';

export const PROPS = {
  /** Probabilidad de que una casilla de arena lleve un objeto encima; en las de ácido nunca. */
  chance: 0.07,
  /**
   * Escala de los objetos respecto a las baldosas.
   * DECISIÓN: a la escala de la lámina un contenedor doblaba al personaje; a la mitad queda un bidón por la cintura.
   */
  scale: 0.5,
  /** Radio de choque en fracción de la mitad del ancho de la base: algo menos, para no chocar con el aire. */
  hit: 0.8,
  /** Solape de las baldosas (TILES.overlap): los objetos se escalan igual que el suelo. */
  overlap: 1.03,
  /** Ancho del rombo de una baldosa en la imagen, en px. */
  tileWidth: 256,
} as const;

/** Lo que escribe tools/slice_props.py en `props.json`. */
export interface PropInfo {
  readonly file: string;
  /** Punto de apoyo (centro de la huella), en fracción del ancho y del alto de la imagen. */
  readonly ax: number;
  readonly ay: number;
  /** Ancho de la base, en px de baldosa. */
  readonly fw: number;
}

export const PROP_LIST: readonly PropInfo[] = index.props;

/**
 * Radio de choque de cada objeto en unidades de mundo. Un círculo de radio r se ve en isométrico con 2r de ancho y
 * una casilla de lado T con T·√2, así que la base (fw px de 256) mide fw/256 · T·√2 · overlap · scale.
 */
export const PROP_RADII: readonly number[] = PROP_LIST.map(
  (p) => ((p.fw / PROPS.tileWidth) * RUN.groundCell * Math.SQRT2 * PROPS.overlap * PROPS.scale * PROPS.hit) / 2,
);
