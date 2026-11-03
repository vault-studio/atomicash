// Estadísticas de la partida para el depurador y la simulación (CAMBIOS §6.4). TS puro; se rellenan desde los sistemas.
import { STAT_ENEMY_IDS, type StatEnemyId } from '../config/enemies';

/** Fuentes de daño al jugador: cada tipo de enemigo y lo que no es un enemigo. */
export const HURT_SOURCES = [...STAT_ENEMY_IDS, 'barril', 'rad', 'tormenta'] as const;
export type HurtSource = (typeof HURT_SOURCES)[number];
export const HURT_INDEX: Readonly<Record<string, number>> = Object.fromEntries(
  HURT_SOURCES.map((s, i) => [s, i]),
);
export const hurtIndex = (s: StatEnemyId | HurtSource): number => HURT_INDEX[s] ?? -1;

export interface RunStats {
  /** Aturdimientos recibidos. */
  stuns: number;
  /** Cargas de interceptor que alcanzaron al jugador y las que esquivó (pasaron de largo). */
  chargesHit: number;
  chargesDodged: number;
  /** Impactos de tiradores especiales recibidos y esquivados. */
  shellsHit: number;
  shellsDodged: number;
  /** Daño recibido por fuente (índice en HURT_SOURCES). */
  readonly dmgTaken: Float64Array;
  /** Última fuente que hizo daño (−1 = ninguna): la causa de la muerte. */
  lastSrc: number;
}

export const createRunStats = (): RunStats => ({
  stuns: 0,
  chargesHit: 0,
  chargesDodged: 0,
  shellsHit: 0,
  shellsDodged: 0,
  dmgTaken: new Float64Array(HURT_SOURCES.length),
  lastSrc: -1,
});

/** Anota daño recibido de la fuente `src` (índice; −1 = desconocida, no se anota). */
export function noteHurt(rs: RunStats, src: number, d: number): void {
  if (src < 0 || d <= 0) return;
  rs.dmgTaken[src] = rs.dmgTaken[src]! + d;
  rs.lastSrc = src;
}
