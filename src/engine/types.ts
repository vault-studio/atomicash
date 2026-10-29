import type { EntityId } from '../config/entities';
import type { EliteId, StatEnemyId } from '../config/enemies';
import type { ConsumableId, ItemId } from '../config/items';
import type { DailyMod, ObjectiveKind } from '../config/modes';
import type { BuildingKind } from '../config/props';
import type { StatSurvivorId } from '../config/survivors';
import type { TreeMod } from '../config/tree';
import type { Rarity, StatKey, TraitId } from '../config/traits';
import type { HordeKind } from '../config/waves';
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
  bossMult: number;
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
  /** Batido turbo restante, en s. */
  turbo: number;
  /** Nuka-pila restante (cadencia doble), en s. */
  nuka: number;
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
  /** Marcha en formación (hordas): segundos que sigue en línea recta por (dx, dy) antes de perseguir. */
  march: number;
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
  /** Cofre especial de un edificio con la guarnición eliminada. */
  | 'cache';

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

export type Card =
  | { kind: 'up' | 'new' | 'fusion'; id: WeaponId }
  | { kind: 'trait'; id: TraitId; rarity: Rarity; value: number }
  | { kind: 'item'; id: ItemId }
  | { kind: 'coupons'; n: number }
  | { kind: 'heal' }
  | { kind: 'purge' };

export interface Choice {
  /**
   * `cache`: tragaperras del cofre especial (una tarjeta de cupones y un nivel). `endless`: ha caído el Coloso y se
   * pregunta si seguir en el modo infinito (sin tarjetas).
   */
  type: 'level' | 'item' | 'cache' | 'endless';
  cards: Card[];
}

export interface World {
  readonly seed: number;
  readonly rng: Rng;
  /** Azar solo para efectos visuales: no altera la secuencia de `rng` de la simulación. */
  readonly fxRng: Rng;
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
  /** Mejoras del árbol de pasivas que no son rasgos (cupones extra, únicos…). */
  readonly mods: Readonly<Partial<Record<TreeMod, number>>>;
  /** Destierros y candados que quedan en la run (del árbol). */
  banishes: number;
  locks: number;
  /** Tarjetas desterradas (`cardKey`): no vuelven a salir en la run. */
  readonly banished: Set<string>;
  /** Tarjeta bloqueada: se guarda para la próxima subida (y sobrevive a los cambios). */
  locked: Card | null;
  /** Rasgos acumulados por stat. */
  readonly tr: Record<StatKey, number>;
  readonly traitPicks: Partial<Record<TraitId, number>>;
  /** Rasgo elegido en cada subida (null si fue otra cosa), para no repetir rachas. */
  readonly levelHistory: (TraitId | null)[];
  /** Objetos de jefe (hasta PLAYER.itemSlots). */
  items: ItemId[];
  weapons: Weapon[];
  readonly cons: Record<ConsumableId, number>;
  consUsed: number;
  /** Consumibles con los que empezó (para devolver a la Mochila lo que sobre). */
  readonly consStart: Readonly<Record<ConsumableId, number>>;

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
  /** Charcos alrededor del jugador (el mapa no tiene bordes; ver engine/hazards.ts). */
  hazards: readonly Hazard[];
  /** Con charcos y obstáculos (las pruebas los quitan para tener el campo limpio). */
  readonly hazardsOn: boolean;
  /** Casilla del jugador cuando se calcularon `hazards`. */
  readonly hazardCell: { i: number; j: number };
  /** Radios de los obstáculos de las casillas alrededor del jugador (ver engine/obstacles.ts). */
  readonly obstacles: Float32Array;
  /** Casilla del jugador cuando se calcularon `obstacles`. */
  readonly obstacleCell: { i: number; j: number };
  /** Edificios alrededor del jugador (para el radar y sus guarniciones). */
  buildings: readonly Building[];
  /** Edificios (`Building.key`) cuya guarnición ya apareció. */
  readonly garrisoned: Set<string>;
  readonly garrisons: Garrison[];
  /** Punto de inicio de la run (alrededor no hay charcos). */
  readonly start: { readonly x: number; readonly y: number };
  readonly pickups: Pool<Pickup>;
  gemCount: number;
  readonly beams: Pool<Beam>;
  readonly booms: Pool<Boom>;
  readonly corpses: Pool<Corpse>;
  readonly texts: Pool<FxText>;
  readonly parts: Pool<Particle>;
  /** Congelación breve del juego tras un golpe gordo (la aplica la sesión, no el tick), en s. */
  hitStop: number;
  /** Máquina de cupones recogida: la sesión para el juego y el render hace la cinemática de victoria. */
  victory: boolean;
  readonly banners: Banner[];

  xp: number;
  level: number;
  xpNext: number;
  kills: number;
  /** Cupones recogidos en la partida. */
  coupons: number;
  dmgTotal: number;
  /** Para el resumen final: golpe más fuerte, pico de DPS y más bajas en 5 s. */
  maxHit: number;
  peakDps: number;
  peakKills5: number;
  /** Bajas por segundo de los últimos 5 s (anillo) y el segundo del último hueco. */
  readonly killRing: Int32Array;
  killSec: number;
  /** Daño y bajas por tramo de `SUMMARY.bucket` segundos. */
  readonly timeDmg: number[];
  readonly timeKills: number[];
  /** Daño hecho a jefes (ranking «daño al jefe», F4). */
  bossDmg: number;
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
  /** Próximo élite y próxima horda, en s de run. */
  nextElite: number;
  nextHorde: number;
  hordeIdx: number;
  /** Horda avisada que aún no ha llegado. */
  horde: Horde | null;
  readonly barrels: Pool<Barrel>;
  /** Tiempo hasta intentar poner más barriles. */
  barrelT: number;
  objective: Objective | null;
  nextObjective: number;
  objectiveIdx: number;
  objectivesDone: number;
  /** Modo infinito tras el Coloso: desde cuándo, próximo jefe y vueltas de la rueda de jefes. */
  endless: boolean;
  endlessAt: number;
  nextEndlessBoss: number;
  endlessLoop: number;
  /** Segundo en que cayó el Coloso (0 si no). */
  winTime: number;
  /** Reto diario: día (UTC, `AAAA-MM-DD`) y modificador; null en una partida normal. */
  readonly daily: string | null;
  readonly dailyMod: DailyMod | null;
  /** Último élite golpeado (id) y cuándo, para su barra en el HUD. */
  eliteFocus: number;
  eliteFocusAt: number;
  /** Bajas seguidas sin recibir daño, y la mejor de la run. */
  streak: number;
  bestStreak: number;
  /** Jefes vivos (para bajar el ritmo de oleadas y la barra de jefe). */
  bossAlive: number;
  shake: number;
  /** Mostrar números de daño (ajuste). */
  showDmg: boolean;
  /** Contadores de sonidos por tipo (índices SFX); el audio reproduce las diferencias entre frames. */
  readonly sfx: Int32Array;
}
