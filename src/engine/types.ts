import type { StatEnemyId } from '../config/enemies';
import type { StatSurvivorId } from '../config/survivors';
import type { Pool } from './pool';
import type { Rng } from './rng';
import type { SpatialHash } from './spatialHash';
import type { ViewExtent } from './view';

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

/** Enemigo reutilizable del pool: todos sus campos se reinician en `spawnEnemy`. */
export interface Enemy {
  /** Identificador único en la run (el índice en el pool cambia al liberar). */
  id: number;
  type: StatEnemyId;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  r: number;
  hp: number;
  maxHp: number;
  speed: number;
  facingX: number;
  facingY: number;
  moving: boolean;
  /** Tiempo de la run en que apareció (para la fase de la animación). */
  born: number;
}

export interface World {
  readonly seed: number;
  readonly rng: Rng;
  /** Segundos de run simulados. */
  time: number;
  ticks: number;
  readonly mapSize: number;
  readonly player: Player;
  /** Enemigos simultáneos antes de reciclar el más lejano. */
  readonly maxEnemies: number;
  readonly enemies: Pool<Enemy>;
  /** Spatial hash de enemigos, reconstruido cada tick. */
  readonly enemyGrid: SpatialHash<Enemy>;
  /** Buffer reutilizable para resultados de consultas al spatial hash. */
  readonly scratch: Int32Array;
  nextId: number;
  /** Apariciones pendientes (acumulador fraccionario del ritmo de la oleada). */
  spawnAcc: number;
  /** Lo que ve la cámara, para que los enemigos aparezcan fuera de ella. */
  readonly view: ViewExtent;
}
