// Balance de enemigos y jefes del Acto 1. Valores de partida del prototipo (atomic-ash-proto.html).
import { ENTITIES, type BossId, type EnemyId, type EntityId } from './entities';

export interface EnemyStats {
  readonly hp: number;
  /** Daño de contacto. */
  readonly dmg: number;
  /** px/s */
  readonly speed: number;
  readonly xp: number;
  /** Radio de colisión explícito; si falta, tamaño × ENEMY_RULES.radiusPerSize. */
  readonly r?: number;
  /** Resistencia al empuje: multiplica el empuje recibido (0 = inamovible). */
  readonly kbRes?: number;
  /** RAD que da su golpe de contacto. */
  readonly rad?: number;
  readonly boss?: boolean;
  /** Vuela: no colisiona, no hace daño de contacto y no lo alcanzan las armas de suelo. */
  readonly flying?: boolean;
}

export const ENEMY_STATS = {
  dron: { hp: 8, dmg: 4, speed: 122, xp: 1 },
  necrofago: { hp: 25, dmg: 8, speed: 78, xp: 1 },
  saqueador: { hp: 40, dmg: 10, speed: 100, xp: 2 },
  tirador: { hp: 30, dmg: 8, speed: 72, xp: 2 },
  reptador: { hp: 35, dmg: 9, speed: 112, xp: 2, rad: 5 },
  hinchado: { hp: 50, dmg: 0, speed: 58, xp: 2 },
  cortacesped: { hp: 60, dmg: 12, speed: 88, xp: 5 },
  torreta: { hp: 120, dmg: 10, speed: 0, xp: 5, kbRes: 0 },
  babosa: { hp: 70, dmg: 8, speed: 50, xp: 3, kbRes: 0.6 },
  aspiradora: { hp: 60, dmg: 10, speed: 80, xp: 2 },
  aspiradora_cria: { hp: 6, dmg: 3, speed: 150, xp: 0, r: 6 },
  // Jefes: no escalan con el tiempo ni se reciclan.
  rey_rata: { hp: 3000, dmg: 18, speed: 76, xp: 60, kbRes: 0, boss: true },
  dirigible: { hp: 7000, dmg: 0, speed: 70, xp: 0, kbRes: 0, boss: true, flying: true },
  coloso: { hp: 20000, dmg: 26, speed: 44, xp: 0, kbRes: 0, boss: true },
} as const satisfies Partial<Record<EnemyId | BossId, EnemyStats>>;

export type StatEnemyId = keyof typeof ENEMY_STATS;
export const STAT_ENEMY_IDS = Object.keys(ENEMY_STATS) as StatEnemyId[];
export type BossKind = 'rey_rata' | 'dirigible' | 'coloso';
export const BOSS_IDS: readonly BossKind[] = ['rey_rata', 'dirigible', 'coloso'];
/** Enemigos normales (los que pueden salir en oleadas). */
export const MOB_IDS = STAT_ENEMY_IDS.filter((id) => !(ENEMY_STATS[id] as EnemyStats).boss);

export const statsOf = (id: StatEnemyId): EnemyStats => ENEMY_STATS[id];

/** Parámetros de comportamiento (F2-03). Los tiempos van en segundos y las distancias en px de mundo. */
export const AI = {
  tirador: { keepMin: 220, keepMax: 270, fireCd: 2.2, bulletSpd: 230, range: 700, strafe: 0.4 },
  hinchado: { boomR: 95, boomEnemyDmg: 30, boomPlayerDmg: 10, boomRad: 8 },
  cortacesped: { every: 4, aim: 0.45, dashSpd: 340, dash: 0.7, range: 500 },
  torreta: { every: 2.6, burst: 3, burstGap: 0.15, bulletSpd: 260, range: 700, sloganChance: 0.3 },
  babosa: { trailEvery: 0.4, trailR: 26, trailLife: 4, trailRad: 5 },
  aspiradora: { children: 4, childType: 'aspiradora_cria', childDist: 18 },
  rey_rata: { every: 3.8, summon: 7, summonType: 'dron', summonDist: 70, aim: 0.75, dashSpd: 440, dash: 0.7 },
  dirigible: {
    orbitR: 320,
    every: 4,
    everyP2: 3,
    p2: 0.5,
    paraCount: 2,
    paraMin: 150,
    paraMax: 300,
    paraWarn: 1.2,
    paraR: 40,
    paraDmg: 15,
    bombCount: 6,
    bombSpacing: 70,
    bombR: 60,
    bombWarn: 1.2,
    bombDmg: 22,
    p2Summon: 6,
    p2SummonType: 'dron',
    p2SummonDist: 340,
    dropXp: 100,
  },
  coloso: {
    every: 3,
    everyP3: 2.1,
    spdP3: 1.35,
    p2: 0.66,
    p3: 0.33,
    stompR: 175,
    stompWarn: 1,
    stompDmg: 30,
    debrisR: 46,
    debrisWarn: 1.1,
    debrisDmg: 20,
    debrisBase: 5,
    debrisPerPhase: 2,
    debrisSpread: 180,
    summonGhouls: 6,
    summonDist: 120,
  },
} as const;

/** Sprite según la fase del jefe (biblia de arte: variantes `_dmg`, `_p2`, `_p3`). */
export const BOSS_VARIANTS: Readonly<
  Partial<Record<StatEnemyId, readonly { below?: number; phase?: number; id: EntityId }[]>>
> = {
  rey_rata: [{ below: 0.5, id: 'rey_rata_dmg' }],
  dirigible: [{ below: 0.5, id: 'dirigible_dmg' }],
  coloso: [
    { phase: 2, id: 'coloso_p2' },
    { phase: 3, id: 'coloso_p3' },
  ],
};

/**
 * Cada jefe sale al llegar a su minuto (`at`, en s) o a su número de bajas (`kills`), lo que pase antes.
 * DECISIÓN: quien mata rápido no espera al reloj; quien va lento tiene el jefe a su hora igualmente.
 */
export const BOSSES: Readonly<Record<BossKind, { at: number; kills: number }>> = {
  rey_rata: { at: 180, kills: 200 },
  dirigible: { at: 360, kills: 500 },
  coloso: { at: 600, kills: 1000 },
};

export const ENEMY_RULES = {
  /** Enemigos simultáneos; al superarlo se recicla el más lejano (05_TECH.md §3). */
  maxAlive: 400,
  /** Radio de colisión = tamaño × este valor. */
  radiusPerSize: 10,
  minRadius: 5,
  /** Empuje máximo por tick al separar dos enemigos solapados, en px. */
  separationMaxPush: 6,
  /** Fracción del solape que corrige cada enemigo (el otro corrige su parte en su turno). */
  separationShare: 0.5,
  /** Vecinos máximos que se miran por enemigo y tick. */
  maxNeighbors: 32,
  /** PV × (1 + t · hpPerSec). Los jefes no escalan. */
  hpPerSec: 1 / 250,
  /** Velocidad por debajo de la cual se considera quieto (para la animación). */
  movingSpeed: 5,
  bulletR: 5,
  bulletLife: 4,
  /** Altura de vuelo en el render, en px de pantalla. */
  flyHeight: 150,
  bossSpawnDist: 520,
} as const;

export function enemyRadius(id: StatEnemyId): number {
  const s: EnemyStats = ENEMY_STATS[id];
  return s.r ?? Math.max(ENEMY_RULES.minRadius, Math.round(ENTITIES[id].size * ENEMY_RULES.radiusPerSize));
}

/** Radio del enemigo más grande, para que las consultas del spatial hash no pierdan vecinos. */
export const MAX_ENEMY_RADIUS = Math.max(...STAT_ENEMY_IDS.map(enemyRadius));
