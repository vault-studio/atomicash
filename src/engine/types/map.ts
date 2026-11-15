import type { ObjectiveKind } from '../../config/modes';
import type { BuildingKind } from '../../config/props';
import type { HordeKind } from '../../config/waves';
import type { Rng } from '../rng';

/**
 * Destrozo de una casilla: escombros (`v` = objeto de `PROP_LIST`), lago de ácido (`v` = radio) o mancha de hielo
 * (sin daño: solo frena al jugador; no bloquea ni el paso ni las balas).
 */
export interface Scar {
  kind: 'rubble' | 'acid' | 'ice';
  v: number;
  x: number;
  y: number;
}

/** Lluvia en curso: tiempo que le queda y hasta el próximo objeto que cae. */
export interface Downpour {
  kind: 'scrap' | 'acid';
  left: number;
  next: number;
}

/** Rastro radiactivo de babosa. */
export interface Slime {
  x: number;
  y: number;
  r: number;
  life: number;
  max: number;
  rad: number;
}

/** Horda anunciada: llega cuando `t` llega a 0, desde la dirección de mundo (ax, ay) respecto al jugador. */
export interface Horde {
  kind: HordeKind;
  t: number;
  ax: number;
  ay: number;
}

/** Barril explosivo; `fuse` ≥ 0 es la mecha encendida (en s) por otra explosión, −1 si está quieto. */
export interface Barrel {
  x: number;
  y: number;
  r: number;
  fuse: number;
}

/** Objetivo del mapa en curso: zona, progreso hacia `goal` y tiempo que queda. */
export interface Objective {
  kind: ObjectiveKind;
  x: number;
  y: number;
  r: number;
  progress: number;
  goal: number;
  left: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Edificio de 3×3 casillas cerca del jugador (ver engine/obstacles.ts). */
export interface Building {
  /** Centro de la huella. */
  readonly x: number;
  readonly y: number;
  readonly kind: BuildingKind;
  /** Casilla de arriba a la izquierda, "i,j": identifica el edificio para no repetir su guarnición. */
  readonly key: string;
}

export interface Hazard {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

export type PickupKind =
  | 'gem'
  | 'stim'
  | 'chest'
  | 'crate'
  | 'medkit'
  | 'magnet'
  | 'bomb'
  | 'coupon'
  /** Crio-granada: congela a los enemigos en pantalla. */
  | 'freeze'
  /** Nuka-pila: cadencia doble durante unos segundos. */
  | 'nuka'
  | 'boots'
  /** Cofre especial de un edificio con la guarnición eliminada. */
  | 'cache';

/**
 * Evento «Tú mismo, otra vez» (engine/systems/mirror.ts). `phase`: 0 esperando, 1 bomba en el suelo, 2 ya explotó.
 * `at` = segundo en que debe salir la bomba (se retrasa con un jefe). `rng` es propio: no toca `World.rng`.
 */
export interface MirrorState {
  phase: 0 | 1 | 2;
  at: number;
  x: number;
  y: number;
  readonly rng: Rng;
}

/** Guarnición de un edificio: dónde sale su cofre y cuántos enemigos quedan. */
export interface Garrison {
  readonly x: number;
  readonly y: number;
  left: number;
}

export interface Pickup {
  kind: PickupKind;
  val: number;
  x: number;
  y: number;
  r: number;
  pull: boolean;
  sp: number;
}
