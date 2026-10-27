// Balance de enemigos del Acto 1. Valores de partida del prototipo (atomic-ash-proto.html).
// Los comportamientos especiales (tirador, hinchado, torreta…) llegan en F2-03; de momento todos persiguen.
import { ENTITIES, type EnemyId } from './entities';

export interface EnemyStats {
  readonly hp: number;
  /** Daño de contacto. */
  readonly dmg: number;
  /** px/s */
  readonly speed: number;
  readonly xp: number;
  /** Radio de colisión explícito; si falta, tamaño × ENEMY_RULES.radiusPerSize. */
  readonly r?: number;
}

export const ENEMY_STATS = {
  dron: { hp: 8, dmg: 4, speed: 122, xp: 1 },
  necrofago: { hp: 25, dmg: 8, speed: 78, xp: 1 },
  saqueador: { hp: 40, dmg: 10, speed: 100, xp: 2 },
  tirador: { hp: 30, dmg: 8, speed: 72, xp: 2 },
  reptador: { hp: 35, dmg: 9, speed: 112, xp: 2 },
  hinchado: { hp: 50, dmg: 0, speed: 58, xp: 2 },
  cortacesped: { hp: 60, dmg: 12, speed: 88, xp: 5 },
  torreta: { hp: 120, dmg: 10, speed: 0, xp: 5 },
  babosa: { hp: 70, dmg: 8, speed: 50, xp: 3 },
  aspiradora: { hp: 60, dmg: 10, speed: 80, xp: 2 },
  aspiradora_cria: { hp: 6, dmg: 3, speed: 150, xp: 0, r: 6 },
} as const satisfies Partial<Record<EnemyId, EnemyStats>>;

export type StatEnemyId = keyof typeof ENEMY_STATS;
export const STAT_ENEMY_IDS = Object.keys(ENEMY_STATS) as StatEnemyId[];

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
} as const;

export function enemyRadius(id: StatEnemyId): number {
  const s: EnemyStats = ENEMY_STATS[id];
  return s.r ?? Math.max(ENEMY_RULES.minRadius, Math.round(ENTITIES[id].size * ENEMY_RULES.radiusPerSize));
}

/** Radio del enemigo más grande, para que las consultas del spatial hash no pierdan vecinos. */
export const MAX_ENEMY_RADIUS = Math.max(...STAT_ENEMY_IDS.map(enemyRadius));
