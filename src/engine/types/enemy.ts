import type { EntityId } from '../../config/entities';
import type { EliteId, StatEnemyId } from '../../config/enemies';

/** Modo de los enemigos que embisten: perseguir, apuntar (quieto) y embestir. */
export const MODE_CHASE = 0;
export const MODE_AIM = 1;
export const MODE_DASH = 2;
export type EnemyMode = typeof MODE_CHASE | typeof MODE_AIM | typeof MODE_DASH;

export type AttackAnim = 'attack' | 'attack_1' | 'attack_2';

/** Huecos de enfriamiento por enemigo para armas orbitales (una por llave). */
export const ORBIT_SLOTS = 5;

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
  dmg: number;
  xp: number;
  facingX: number;
  facingY: number;
  moving: boolean;
  /** Tiempo de la run en que apareció (para la fase de la animación). */
  born: number;
  /** Muerto en este tick; se retira del pool al final del tick. */
  dead: boolean;
  /** Variante irradiada. */
  irr: boolean;
  /** Enfurecido (ver `RAGE` y engine/rage.ts): ya lleva aplicado su bonus de daño; la velocidad se calcula al moverse. */
  rage: boolean;
  /** Estado del ciclo de furia: segundos que le quedan, de enfriamiento, de persecución y veces que se ha enfurecido. */
  rageT: number;
  rageCd: number;
  chase: number;
  rageN: number;
  /** Daño de contacto que tenía antes de la furia en curso, para devolvérselo al calmarse. */
  rageDmg: number;
  boss: boolean;
  flying: boolean;
  /** Guarnición a la que pertenece (índice en `World.garrisons`), o −1. */
  gar: number;
  /** Enfriamiento del golpe de contacto. */
  atkCd: number;
  kbx: number;
  kby: number;
  /** Destello al recibir daño, en s. */
  flash: number;
  mode: EnemyMode;
  /** Tiempo restante del modo actual. */
  mt: number;
  /** Dirección fijada al apuntar una embestida. */
  dx: number;
  dy: number;
  burst: number;
  bt: number;
  stun: number;
  /** Congelado por la crio-granada: ni se mueve ni ataca, en s. */
  frozen: number;
  /** Ralentizado por un arma: segundos que le quedan y multiplicador de su velocidad. */
  slowT: number;
  slowK: number;
  /** Contador de rotación de ataques del jefe. */
  act: number;
  alt: boolean;
  phase: number;
  /** Tiempo de la run del último ataque (para la animación). */
  lastAtk: number;
  atkAnim: AttackAnim;
  trail: number;
  timer: number;
  /** Sentido de giro al rodear (−1 o 1). */
  side: number;
  /** Prefijo de élite, o null si es normal. */
  elite: EliteId | null;
  /** Sprite propio que sustituye al del tipo (la copia del jugador usa el de su personaje); null = el del tipo. */
  skin: EntityId | null;
  /** Marcha en formación (hordas): segundos que sigue en línea recta por (dx, dy) antes de perseguir. */
  march: number;
  /** Tiempo de la run del primer golpe recibido en esta vida (para el tiempo para matar; -1 = sin golpes). */
  hitAt: number;
  /** Último golpe de cada arma orbital, por hueco. */
  readonly hitT: Float64Array;
  /** Quemaduras del cóctel: tiempo que le queda a cada una (0 = hueco libre) y su daño por segundo. */
  readonly burnT: Float64Array;
  readonly burnD: Float64Array;
  /** Tiempo hasta el próximo golpe de quemadura. */
  burnTick: number;
  /** Tick (`World.ticks`) en que pisó fuego por última vez y cuánto lleva seguido dentro. */
  fireAt: number;
  /** Último golpe de charco (s de partida): varios charcos solapados no suman (uno por intervalo). */
  poolAt: number;
  fireIn: number;
}
