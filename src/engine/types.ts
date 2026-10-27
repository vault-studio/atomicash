import type { StatSurvivorId } from '../config/survivors';
import type { Rng } from './rng';

/** Entrada ya convertida a coordenadas de mundo. Magnitud ≤ 1. */
export interface InputState {
  moveX: number;
  moveY: number;
}

export interface Player {
  readonly charId: StatSurvivorId;
  x: number;
  y: number;
  /** Posición del paso anterior, para interpolar el render. */
  prevX: number;
  prevY: number;
  readonly r: number;
  speed: number;
  hp: number;
  maxHp: number;
  /** Última dirección de movimiento (unitaria), para elegir la fila del sprite. */
  facingX: number;
  facingY: number;
  moving: boolean;
  /** Tiempo de la run en que murió; null si sigue vivo. */
  deadAt: number | null;
}

export interface World {
  readonly seed: number;
  readonly rng: Rng;
  /** Segundos de run simulados. */
  time: number;
  ticks: number;
  readonly mapSize: number;
  readonly player: Player;
}
