// Oleadas del Acto 1 «Las Afueras» (02_GAMEPLAY.md §5). Valores de partida del prototipo.
// Cada entrada rige desde `from` (segundos) hasta la siguiente.
import type { StatEnemyId } from './enemies';

export interface WaveDef {
  /** Segundo de la run en que empieza. */
  readonly from: number;
  /** Enemigos que aparecen por segundo. */
  readonly rate: number;
  /** Máximo de enemigos vivos; si se alcanza, no aparecen más hasta que mueran. */
  readonly max: number;
  /** Pesos relativos de cada tipo. */
  readonly mix: Readonly<Partial<Record<StatEnemyId, number>>>;
}

export const WAVES: readonly WaveDef[] = [
  { from: 0, rate: 1.3, max: 40, mix: { dron: 6, necrofago: 4 } },
  { from: 60, rate: 2.0, max: 70, mix: { dron: 5, necrofago: 5, saqueador: 2 } },
  {
    from: 120,
    rate: 2.6,
    max: 100,
    mix: { necrofago: 4, saqueador: 3, reptador: 3, dron: 3, aspiradora: 1 },
  },
  {
    from: 200,
    rate: 3.2,
    max: 130,
    mix: { saqueador: 4, reptador: 3, tirador: 2, hinchado: 2, aspiradora: 2, dron: 3 },
  },
  // Respiro antes del Rey Rata (minuto 5)
  { from: 300, rate: 3.0, max: 120, mix: { dron: 5, necrofago: 4, saqueador: 3 } },
  {
    from: 360,
    rate: 3.8,
    max: 160,
    mix: { saqueador: 4, tirador: 2, hinchado: 2, babosa: 2, aspiradora: 3, reptador: 3 },
  },
  {
    from: 450,
    rate: 4.4,
    max: 190,
    mix: { cortacesped: 2, saqueador: 4, babosa: 2, reptador: 3, tirador: 2, aspiradora: 2, necrofago: 3 },
  },
  {
    from: 540,
    rate: 5.0,
    max: 220,
    mix: { cortacesped: 3, torreta: 1, saqueador: 4, babosa: 3, hinchado: 3, reptador: 3 },
  },
  // Respiro antes del Dirigible (minuto 10)
  { from: 600, rate: 4.0, max: 180, mix: { dron: 5, necrofago: 4, saqueador: 3, reptador: 2 } },
  {
    from: 660,
    rate: 5.6,
    max: 260,
    mix: { cortacesped: 3, torreta: 1, babosa: 3, aspiradora: 3, saqueador: 4, reptador: 4, tirador: 2 },
  },
  {
    from: 750,
    rate: 6.4,
    max: 300,
    mix: { cortacesped: 4, torreta: 2, babosa: 3, aspiradora: 4, saqueador: 4, reptador: 4, hinchado: 2 },
  },
  // Respiro antes del Coloso (minuto 14)
  { from: 840, rate: 5.0, max: 240, mix: { necrofago: 4, saqueador: 3, reptador: 3, dron: 5 } },
];

export const SPAWN = {
  /** Distancia mínima al jugador, en px de mundo, aunque la cámara vea menos. */
  minDist: 640,
  /** Margen extra fuera del borde de la cámara, en px de mundo. */
  offscreenMargin: 60,
  /** Variación aleatoria añadida a la distancia (siempre hacia fuera). */
  jitter: 80,
  /** Los enemigos más lejos que esto vuelven a aparecer cerca, fuera de cámara (no aplica a jefes). */
  relocateDist: 1500,
  /** Las torretas aparecen ya dentro de este anillo (no se mueven). */
  staticMin: 400,
  staticMax: 600,
  /** Con un jefe vivo aparecen menos enemigos. */
  bossRateMult: 0.7,
  /** Rastros de babosa simultáneos. */
  maxSlime: 120,
} as const;

/**
 * Eventos del director (02_GAMEPLAY.md §7: «1 cada ~3 min»), rotando, con silencio tras un jefe.
 * DECISIÓN: el prototipo lanzaba uno por minuto; se sigue la especificación.
 */
export const EVENTS = {
  first: 90,
  every: 180,
  order: ['supply', 'swarm', 'rain'] as const,
  bossQuiet: 20,
  supply: { dist: 320, gems: 4, gemValue: 5 },
  swarm: { count: 28, r: 380, type: 'dron' as const },
  rain: { dur: 12, spawnMult: 1.3, xpMult: 2 },
} as const;

export type EventKind = (typeof EVENTS.order)[number];
