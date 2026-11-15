import type { StatEnemyId } from '../../config/enemies';
import type { WeaponId } from '../../config/weapons';

export interface Weapon {
  id: WeaponId;
  lvl: number;
  cd: number;
  /** Ángulo de las armas orbitales. */
  a: number;
  /** Radio actual de auras (para el render). */
  r: number;
  /** Segundo temporizador (rayos del núcleo inestable). */
  cd2: number;
  /** Segundo de la run en que se consiguió (para su DPS en la pausa). */
  got: number;
}

export const SHOT_HITS = 16;

export interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  dmg: number;
  pierce: number;
  src: WeaponId;
  direct: boolean;
  kb: number;
  /** IDs de los enemigos ya golpeados (no golpea dos veces al mismo). */
  readonly hit: Int32Array;
  nHit: number;
}

export interface EnemyBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  rad: number;
  life: number;
  /** Quién la disparó (índice en HURT_SOURCES), para las estadísticas. */
  src: number;
}

export interface Lob {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  t: number;
  dur: number;
  lvl: number;
}

/** Charco de daño (cóctel, dardos incendiarios). */
export interface FirePool {
  x: number;
  y: number;
  r: number;
  life: number;
  max: number;
  tick: number;
  tickCd: number;
  dmg: number;
  /** Daño por segundo de la quemadura que pega a quien lo pisa (0 = no quema). */
  burn: number;
  src: WeaponId;
}

/** Petardo de la ristra: vuela en arco de (sx, sy) a (x, y) y, ya en el suelo, revienta cuando `t` llega a 0. */
export interface Mine {
  x: number;
  y: number;
  sx: number;
  sy: number;
  /** Vuelo restante y total, en s (0 = en el suelo). */
  fly: number;
  flyDur: number;
  t: number;
  r: number;
  dmg: number;
}

/** Lo que cae del cielo y deja un destrozo en el mapa al llegar al suelo (ver engine/scars.ts). */
export type TeleFall = 'shell' | 'scrap' | 'acid' | 'barrel' | 'ice';

/**
 * Aviso en el suelo de un ataque de jefe; al acabar, explota (y quizá crea un enemigo). Si (lx, ly) no es cero es un
 * pasillo de anchura 2r desde (x, y) hasta (x + lx, y + ly). Con `dmg` 0 solo avisa (la embestida hace el daño).
 */
export interface Telegraph {
  x: number;
  y: number;
  r: number;
  lx: number;
  ly: number;
  t: number;
  dur: number;
  dmg: number;
  spawn: StatEnemyId | null;
  /** Quién lo lanzó (índice en HURT_SOURCES), para las estadísticas. */
  src: number;
  /** RAD que da si alcanza al jugador. */
  rad: number;
  /** Lo que cae, si deja destrozo; `hz` es el radio del lago (en `HAZARDS.cellRadii`) si es ácido o un barril. */
  fall: TeleFall | null;
  hz: number;
}
