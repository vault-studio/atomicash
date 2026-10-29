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

// DECISIÓN: cada jefe llega con un minuto de respiro (menos enemigos y de los flojos) a su hora (BOSSES.at); entre
// respiros, la dificultad sube al mismo ritmo que antes. Si el jefe sale antes por bajas, el respiro sigue a su hora.
export const WAVES: readonly WaveDef[] = [
  { from: 0, rate: 1.3, max: 40, mix: { dron: 6, necrofago: 4 } },
  { from: 60, rate: 2.0, max: 70, mix: { dron: 5, necrofago: 5, saqueador: 2 } },
  {
    from: 120,
    rate: 2.6,
    max: 100,
    mix: { necrofago: 4, saqueador: 3, reptador: 3, dron: 3, aspiradora: 1 },
  },
  // Respiro: Rey Rata (minuto 3)
  { from: 180, rate: 2.2, max: 90, mix: { dron: 5, necrofago: 4, saqueador: 3 } },
  {
    from: 240,
    rate: 3.2,
    max: 130,
    mix: { saqueador: 4, reptador: 3, tirador: 2, hinchado: 2, aspiradora: 2, dron: 3, blindado: 1 },
  },
  {
    from: 300,
    rate: 3.8,
    max: 160,
    mix: {
      saqueador: 4,
      tirador: 2,
      hinchado: 2,
      babosa: 2,
      aspiradora: 3,
      reptador: 3,
      blindado: 2,
      predicador: 1,
    },
  },
  // Respiro: Dirigible (minuto 6)
  { from: 360, rate: 3.0, max: 120, mix: { dron: 5, necrofago: 4, saqueador: 3, reptador: 2 } },
  {
    from: 420,
    rate: 4.4,
    max: 190,
    mix: {
      cortacesped: 2,
      saqueador: 4,
      babosa: 2,
      reptador: 3,
      tirador: 2,
      aspiradora: 2,
      necrofago: 3,
      blindado: 2,
      predicador: 1,
    },
  },
  {
    from: 510,
    rate: 5.0,
    max: 220,
    mix: {
      cortacesped: 3,
      torreta: 1,
      saqueador: 4,
      babosa: 3,
      hinchado: 3,
      reptador: 3,
      blindado: 2,
      predicador: 2,
    },
  },
  // Respiro: Coloso (minuto 10)
  { from: 600, rate: 4.0, max: 180, mix: { necrofago: 4, saqueador: 3, reptador: 3, dron: 5 } },
  {
    from: 660,
    rate: 5.6,
    max: 260,
    mix: {
      cortacesped: 3,
      torreta: 1,
      babosa: 3,
      aspiradora: 3,
      saqueador: 4,
      reptador: 4,
      tirador: 2,
      blindado: 3,
      predicador: 1,
    },
  },
  {
    from: 750,
    rate: 6.4,
    max: 300,
    mix: {
      cortacesped: 4,
      torreta: 2,
      babosa: 3,
      aspiradora: 4,
      saqueador: 4,
      reptador: 4,
      hinchado: 2,
      blindado: 3,
      predicador: 2,
    },
  },
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
  /**
   * Multiplicador global del ritmo de aparición de todas las oleadas.
   * DECISIÓN: menos enemigos que dan mucha más experiencia (XP.killMult): se sube de nivel más a menudo con menos
   * agobio en pantalla, ahora que la cámara está más cerca.
   */
  rateMult: 0.7,
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

/**
 * Hordas en formación (dossier §10), con aviso en el borde de la pantalla `warn` s antes:
 * - `ring`: anillo que se cierra desde fuera de cámara.
 * - `stampede`: estampida que cruza la pantalla en línea recta (apunta a donde estabas).
 * - `wall`: muro que avanza en formación hacia el jugador y luego persigue.
 * El tipo de enemigo sale de `types` según el minuto (el último cuyo `from` se ha pasado).
 */
export const HORDES = {
  first: 50,
  everyMin: 45,
  everyMax: 70,
  warn: 2.2,
  order: ['ring', 'stampede', 'wall'] as const,
  /** Margen fuera de cámara donde aparecen, en px de mundo. */
  margin: 50,
  ring: {
    count: 22,
    perMin: 2.5,
    max: 48,
    types: [
      { from: 0, type: 'necrofago' },
      { from: 300, type: 'saqueador' },
    ],
  },
  stampede: {
    count: 18,
    perMin: 1.5,
    max: 34,
    /** Anchura del rebaño (perpendicular a la marcha) y separación entre filas. */
    width: 220,
    rowGap: 34,
    speed: 1.6,
    types: [
      { from: 0, type: 'dron' },
      { from: 240, type: 'reptador' },
    ],
  },
  wall: {
    count: 20,
    perMin: 1.5,
    max: 36,
    spacing: 30,
    /** Segundos extra de marcha en formación tras llegar a la altura del jugador. */
    extra: 1.5,
    types: [
      { from: 0, type: 'necrofago' },
      { from: 200, type: 'saqueador' },
      { from: 480, type: 'cortacesped' },
    ],
  },
} as const;

export type HordeKind = (typeof HORDES.order)[number];
