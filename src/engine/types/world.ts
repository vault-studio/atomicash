import type { ActId } from '../../config/acts';
import type { RunStats } from '../runStats';
import type { ConsumableId, ItemId } from '../../config/items';
import type { DailyMod } from '../../config/modes';
import type { StatSurvivorId } from '../../config/survivors';
import type { TreeMod } from '../../config/tree';
import type { StatKey, TraitId } from '../../config/traits';
import type { WeaponId } from '../../config/weapons';
import type { Pool } from '../pool';
import type { Rng } from '../rng';
import type { SpatialHash } from '../spatialHash';
import type { ViewExtent } from '../view';
import type { Card, Choice } from './cards';
import type { Enemy } from './enemy';
import type { Banner, Beam, Boom, Corpse, FxText, Particle, Wreck } from './fx';
import type {
  Barrel,
  Building,
  Downpour,
  Garrison,
  Hazard,
  Horde,
  MirrorState,
  Objective,
  Pickup,
  Point,
  Scar,
  Slime,
} from './map';
import type { Player, PlayerStats } from './player';
import type { EnemyBullet, FirePool, Lob, Mine, Shot, Telegraph, Weapon } from './projectiles';

export interface World {
  readonly seed: number;
  /** Acto en curso: decide el suelo, los objetos del mapa, las oleadas y el jefe. */
  act: ActId;
  /** Segundo de la run (`time`) en que empezó el acto. */
  actStart: number;
  /** Ha caído el jefe del acto y `updateCampaign` aún no ha empezado la transición. */
  actBossDown: boolean;
  /** Transición al acto siguiente: cuándo cayó el jefe (−1 = no hay) y cuándo empezó el fundido (−1 = todavía no). */
  actClearAt: number;
  actFadeAt: number;
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
  /** Arma inicial; si se fusiona, pasa a ser la fusión (recibe `st.starterMult`). */
  starter: WeaponId | null;
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
  /** Estadísticas de la partida (depurador y simulación). */
  readonly rs: RunStats;
  readonly slimes: Pool<Slime>;
  /** Charcos alrededor del jugador (el mapa no tiene bordes; ver engine/hazards.ts). */
  hazards: Hazard[];
  /** Con charcos y obstáculos (las pruebas los quitan para tener el campo limpio). */
  readonly hazardsOn: boolean;
  /** Destrozos del mapa por casilla (`cellKey`). Solo crecen: el render repinta el suelo cuando cambia su tamaño. */
  readonly scars: Map<number, Scar>;
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
  /** Punto de inicio del acto (alrededor no hay charcos ni objetos). */
  readonly start: { x: number; y: number };
  readonly pickups: Pool<Pickup>;
  gemCount: number;
  readonly beams: Pool<Beam>;
  readonly booms: Pool<Boom>;
  readonly corpses: Pool<Corpse>;
  readonly wrecks: Pool<Wreck>;
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

  /** Próximo evento especial, en s de run, e índice en `CAMPAIGN.specials.times`. */
  nextSpecial: number;
  specialIdx: number;
  /** Lluvia radiactiva restante, en s. */
  rain: number;
  storm: boolean;
  lastBossAt: number;
  readonly bossSpawned: Record<string, boolean>;
  /** Próximo élite, en s de run. */
  nextElite: number;
  /** Turno de hordas de la tecla de depuración. */
  hordeIdx: number;
  /** Horda avisada que aún no ha llegado. */
  horde: Horde | null;
  readonly barrels: Pool<Barrel>;
  /** Tiempo hasta intentar poner más barriles. */
  barrelT: number;
  mirror: MirrorState;
  objective: Objective | null;
  nextObjective: number;
  /** Lluvia de chatarra o de ácido en curso (la radiactiva de los eventos es `rain`). */
  downpour: Downpour | null;
  /** Turno de lluvias de la tecla de depuración. */
  downpourIdx: number;
  objectiveIdx: number;
  objectivesDone: number;
  /** Modo infinito tras el Coloso: desde cuándo. */
  endless: boolean;
  endlessAt: number;
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
  /** Posición del último sonido de cada tipo (para colocarlo en el estéreo). */
  readonly sfxX: Float32Array;
  readonly sfxY: Float32Array;
  /** Distancia² al jugador y momento del sonido guardado (para quedarse con el más cercano de cada paso). */
  readonly sfxD: Float32Array;
  readonly sfxT: Float64Array;
}
