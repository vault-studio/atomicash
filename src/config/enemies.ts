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
  rey_rata: {
    every: 3.8,
    summon: 7,
    summonType: 'dron',
    summonDist: 70,
    aim: 0.75,
    dashSpd: 440,
    dash: 0.7,
    /** Fase 2 (por debajo de `p2`): ataca más a menudo, embiste dos veces seguidas y llama a más ratas. */
    p2: 0.5,
    everyP2: 2.8,
    summonP2: 10,
    aimP2: 0.55,
  },
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
    /** Anchura del pasillo que marca el bombardeo en el suelo. */
    laneR: 34,
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

/** Colores de las esquirlas al golpear o matar (solo visual): chispas de chatarra o vísceras del páramo. */
const SPARKS = [0xffd34a, 0xff8a2a, 0xb8bec6, 0x6c7178] as const;
const GUTS = [0x8bc34a, 0x5e8a2c, 0x7a3b2a, 0xc0d860] as const;
export const GORE: Readonly<Record<StatEnemyId, readonly number[]>> = {
  dron: SPARKS,
  necrofago: GUTS,
  saqueador: [0xa8382a, 0x6a2a20, 0xc8a070],
  tirador: [0xa8382a, 0x6a2a20, 0xc8a070],
  reptador: GUTS,
  hinchado: [0xc8dc50, 0x9dff00, 0x5e8a2c],
  cortacesped: SPARKS,
  torreta: SPARKS,
  babosa: [0x7dff3a, 0x4ac02a, 0xc0ff8a],
  aspiradora: SPARKS,
  aspiradora_cria: SPARKS,
  rey_rata: [0xa8382a, 0x6a2a20, 0x8a7a6a],
  dirigible: SPARKS,
  coloso: SPARKS,
};
/** Esquirlas de los irradiados. */
export const GORE_IRR: readonly number[] = [0xa8ff70, 0x9dff00, 0xe8ffb0];

/** Prefijos de élite (dossier §4): cada uno con su color de aura y su truco. */
export type EliteId = 'blindado' | 'veloz' | 'radiactivo' | 'divisor' | 'vampirico';
export const ELITE_IDS: readonly EliteId[] = ['blindado', 'veloz', 'radiactivo', 'divisor', 'vampirico'];

/**
 * Élites: un enemigo de la oleada vigente, más grande y duro, cada 60–90 s. Suelta siempre un cofre.
 * DECISIÓN: el cofre es el especial (tragaperras de cupones y un nivel): los cofres de objeto son de los jefes y solo
 * hay dos huecos, así que un élite no puede quitarle el hueco a un jefe.
 */
export const ELITES = {
  first: 75,
  everyMin: 60,
  everyMax: 90,
  /** Multiplicadores sobre el enemigo normal. */
  hp: 14,
  r: 1.35,
  xp: 12,
  /** Empuje que recibe (fracción). */
  kb: 0.3,
  /** Escala del sprite en el render. */
  scale: 1.3,
  /** Tipos que nunca salen de élite (no se mueven o son crías). */
  exclude: ['torreta', 'aspiradora_cria'] as readonly StatEnemyId[],
  /** Segundos que sigue la barra en el HUD desde el último golpe. */
  barTime: 4,
  blindado: { color: 0xc8ccd0, dmgTaken: 0.5 },
  veloz: { color: 0x7fd8ff, speed: 1.7 },
  radiactivo: { color: 0x9dff00, auraR: 120, auraRad: 7 },
  divisor: { color: 0xff8a2a, split: 4, splitDist: 26 },
  vampirico: { color: 0xd7263d, healOnHit: 0.15, regen: 0.01 },
} as const;

/** Fracciones de vida donde cambia de fase cada jefe (marcas de la barra del HUD). */
export const BOSS_PHASES: Readonly<Record<BossKind, readonly number[]>> = {
  rey_rata: [0.5],
  dirigible: [0.5],
  coloso: [0.66, 0.33],
};
