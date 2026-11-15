import type { EntityId } from '../../config/entities';

export const BEAM_POINTS = 16;

export interface Beam {
  /** Pares x, y en coordenadas de mundo. */
  readonly pts: Float32Array;
  n: number;
  life: number;
  max: number;
  color: number;
}

export interface Boom {
  x: number;
  y: number;
  r: number;
  life: number;
  max: number;
  color: number;
}

export interface Corpse {
  sprite: EntityId;
  x: number;
  y: number;
  facingX: number;
  facingY: number;
  t: number;
  flying: boolean;
  irr: boolean;
}

/**
 * Restos de un robot reventado (solo visual): el render saca de `seed` cómo vuela cada pieza, así que el motor no
 * sabe nada de su dibujo.
 */
export interface Wreck {
  sprite: EntityId;
  x: number;
  y: number;
  t: number;
  /** Momento en que desaparece. */
  until: number;
  seed: number;
  flying: boolean;
  elite: boolean;
}

/** Esquirla de un golpe o una baja (solo visual): vuela con gravedad en `z` y se apaga. */
export interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  color: number;
  size: number;
}

export type FxKind = 'dmg' | 'crit' | 'hurt' | 'dodge' | 'pickup' | 'slogan';

/** Texto flotante. `value` es el número (daño) o el índice del eslogan; `key`, la clave i18n. */
export interface FxText {
  kind: FxKind;
  x: number;
  y: number;
  value: number;
  key: string;
  life: number;
}

/** Aviso grande en pantalla. El texto se traduce en la UI con `key` y `params`. */
export interface Banner {
  key: string;
  params: Readonly<Record<string, string>>;
  life: number;
}
