import type { EntityId } from '../config/entities';
import type { StatEnemyId } from '../config/enemies';
import type { ConsumableId, ItemId } from '../config/items';
import type { StatSurvivorId } from '../config/survivors';
import type { Rarity, StatKey, TraitId } from '../config/traits';
import type { WeaponId } from '../config/weapons';
import type { Pool } from './pool';
import type { Rng } from './rng';
import type { SpatialHash } from './spatialHash';
import type { ViewExtent } from './view';

/** Entrada ya convertida a coordenadas de mundo. Magnitud ≤ 1. */
export interface InputState {
  moveX: number;
  moveY: number;
}

/** Stats derivados del jugador; se recalculan cada tick sin crear objetos (`recalc`). */
export interface PlayerStats {
  maxHp: number;
  speed: number;
  magnet: number;
  armor: number;
  luck: number;
  dmgMult: number;
  cdMult: number;
  regen: number;
  xpMult: number;
  red: number;
  dodge: number;
  crit: number;
  area: number;
  pierce: number;
  kb: number;
  radGain: number;
  radDecayBonus: number;
  meleeMult: number;
}

export interface Player {
  readonly charId: StatSurvivorId;
  x: number;
  y: number;
  /** Posición del paso anterior, para interpolar el render. */
  prevX: number;
  prevY: number;
  readonly r: number;
  hp: number;
  maxHp: number;
  /** Última dirección de movimiento (unitaria), para elegir la fila del sprite. */
  facingX: number;
  facingY: number;
  moving: boolean;
  /** Tiempo de la run en que murió; null si sigue vivo. */
  deadAt: number | null;
  /** Invulnerabilidad restante, en s. */
  inv: number;
  /** Radiación 0–100. */
  rad: number;
  radPeak: number;
  /** Segundos sin recibir radiación. */
  radIdle: number;
  /** Batido turbo restante, en s. */
  turbo: number;
  /** Curación por bajas disponible (tope por segundo). */
  healBudget: number;
  /** Tiempo de la run del último golpe recibido. */
  lastHit: number;
  /** Depuración: no recibe daño. */
  god: boolean;
}

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
  boss: boolean;
  flying: boolean;
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
  /** Último golpe de cada arma orbital, por hueco. */
  readonly hitT: Float64Array;
}

export interface Weapon {
  id: WeaponId;
  lvl: number;
  cd: number;
  /** Ángulo de las armas orbitales. */
  a: number;
  /** Radio actual de auras (para el render). */
  r: number;
  /** Petardos: distancia recorrida desde la última mecha. */
  dist: number;
  lx: number;
  ly: number;
  /** Segundo temporizador (rayos del núcleo inestable). */
  cd2: number;
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
  src: WeaponId;
}

export interface Mine {
  x: number;
  y: number;
  t: number;
  r: number;
  dmg: number;
}

/** Aviso en el suelo de un ataque de jefe; al acabar, explota (y quizá crea un enemigo). */
export interface Telegraph {
  x: number;
  y: number;
  r: number;
  t: number;
  dur: number;
  dmg: number;
  spawn: StatEnemyId | null;
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

export interface Point {
  x: number;
  y: number;
}

export interface Hazard {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

export type PickupKind = 'gem' | 'stim' | 'chest' | 'crate';

export interface Pickup {
  kind: PickupKind;
  val: number;
  x: number;
  y: number;
  r: number;
  pull: boolean;
  sp: number;
}

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

export type Card =
  | { kind: 'up' | 'new' | 'fusion'; id: WeaponId }
  | { kind: 'trait'; id: TraitId; rarity: Rarity; value: number }
  | { kind: 'item'; id: ItemId }
  | { kind: 'keep' }
  | { kind: 'heal' }
  | { kind: 'purge' };

export interface Choice {
  type: 'level' | 'item';
  cards: Card[];
}

export interface World {
  readonly seed: number;
  readonly rng: Rng;
  readonly charId: StatSurvivorId;
  /** Segundos de run simulados. */
  time: number;
  ticks: number;
  readonly mapSize: number;
  readonly player: Player;
  /** Stats derivados del jugador (rasgos, objeto, RAD, turbo). */
  readonly st: PlayerStats;
  /** Run terminada (muerte o victoria). */
  over: boolean;
  won: boolean;
  /** Elección abierta (subida de nivel o cofre): el motor se pausa hasta resolverla. */
  choice: Choice | null;
  pendingLevels: number;
  rerolls: number;
  /** Rasgos acumulados por stat. */
  readonly tr: Record<StatKey, number>;
  readonly traitPicks: Partial<Record<TraitId, number>>;
  /** Rasgo elegido en cada subida (null si fue otra cosa), para no repetir rachas. */
  readonly levelHistory: (TraitId | null)[];
  item: ItemId | null;
  weapons: Weapon[];
  readonly cons: Record<ConsumableId, number>;
  consUsed: number;

  /** Enemigos simultáneos antes de reciclar el más lejano. */
  readonly maxEnemies: number;
  readonly enemies: Pool<Enemy>;
  /** Spatial hash de enemigos, reconstruido cada tick. */
  readonly enemyGrid: SpatialHash<Enemy>;
  /** Buffers de consultas al spatial hash: IA, armas, rayos encadenados y explosiones. */
  readonly scratch: Int32Array;
  readonly qWeapon: Int32Array;
  readonly qChain: Int32Array;
  readonly qBlast: Int32Array;
  /** Explosiones de hinchados pendientes de resolver. */
  readonly blasts: Pool<Point>;
  nextId: number;
  /** Apariciones pendientes (acumulador fraccionario del ritmo de la oleada). */
  spawnAcc: number;
  /** Lo que ve la cámara, para que los enemigos aparezcan fuera de ella. */
  readonly view: ViewExtent;

  readonly shots: Pool<Shot>;
  readonly ebullets: Pool<EnemyBullet>;
  readonly lobs: Pool<Lob>;
  readonly pools: Pool<FirePool>;
  readonly mines: Pool<Mine>;
  readonly tele: Pool<Telegraph>;
  readonly slimes: Pool<Slime>;
  readonly hazards: readonly Hazard[];
  readonly pickups: Pool<Pickup>;
  gemCount: number;
  readonly beams: Pool<Beam>;
  readonly booms: Pool<Boom>;
  readonly corpses: Pool<Corpse>;
  readonly texts: Pool<FxText>;
  readonly banners: Banner[];

  xp: number;
  level: number;
  xpNext: number;
  kills: number;
  dmgTotal: number;
  /** Daño por fuente (índices de DAMAGE_SOURCES). */
  readonly dmgBy: Float64Array;
  /** Daño en cubetas de 0,25 s (anillo de 16) para el DPS del HUD. */
  readonly dpsB: Float64Array;
  dpsBucket: number;
  bosses: number;

  nextEvent: number;
  eventIdx: number;
  /** Lluvia radiactiva restante, en s. */
  rain: number;
  storm: boolean;
  lastBossAt: number;
  readonly bossSpawned: Record<string, boolean>;
  /** Jefes vivos (para bajar el ritmo de oleadas y la barra de jefe). */
  bossAlive: number;
  shake: number;
  /** Mostrar números de daño (ajuste). */
  showDmg: boolean;
}
