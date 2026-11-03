// Oleadas del Acto 1 «Las Afueras» (02_GAMEPLAY.md §5). Valores de partida del prototipo.
// Cada entrada rige desde `from` (segundos) hasta la siguiente.
import { TUNING as T, type DeepReadonly, type Retype } from './tuning';
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
/**
 * Valores en `src/data/tuning.json` → `waves`. Notas por campo:
 * - `…`: Respiro: Rey Rata (minuto 3)
 * - `…`: Respiro: Dirigible (minuto 6)
 * - `…`: Respiro: Coloso (minuto 10)
 */
export const WAVES: readonly WaveDef[] = T.waves;

/**
 * Valores en `src/data/tuning.json` → `spawn`. Notas por campo:
 * - `minDist`: Distancia mínima al jugador, en px de mundo, aunque la cámara vea menos.
 * - `offscreenMargin`: Margen extra fuera del borde de la cámara, en px de mundo.
 * - `jitter`: Variación aleatoria añadida a la distancia (siempre hacia fuera).
 * - `relocateDist`: Los enemigos más lejos que esto vuelven a aparecer cerca, fuera de cámara (no aplica a
 *   jefes).
 * - `staticMin`: Las torretas aparecen ya dentro de este anillo (no se mueven).
 * - `bossRateMult`: Con un jefe vivo no aparece nadie más (oleadas, eventos ni guarniciones): el combate es solo
 *   contra él y lo que invoca. Lo que ya estaba vivo sigue.
 * - `rateMult`: Multiplicador global del ritmo de aparición de todas las oleadas. DECISIÓN: menos enemigos que
 *   dan mucha más experiencia (XP.killMult): se sube de nivel más a menudo con menos agobio en pantalla, ahora que
 *   la cámara está más cerca.
 * - `maxSlime`: Rastros de babosa simultáneos.
 */
export const SPAWN: DeepReadonly<typeof T.spawn> = T.spawn;

/**
 * Eventos del director (02_GAMEPLAY.md §7: «1 cada ~3 min»), rotando, con silencio tras un jefe.
 * DECISIÓN: el prototipo lanzaba uno por minuto; se sigue la especificación.
 */
export const EVENTS = T.events as Retype<
  typeof T.events,
  { order: readonly EventKind[]; swarm: { type: StatEnemyId } }
>;

export type EventKind = 'supply' | 'swarm' | 'rain';

/**
 * Hordas en formación (dossier §10), con aviso en el borde de la pantalla `warn` s antes:
 * - `ring`: anillo que se cierra desde fuera de cámara.
 * - `stampede`: estampida que cruza la pantalla en línea recta (apunta a donde estabas).
 * - `wall`: muro que avanza en formación hacia el jugador y luego persigue.
 * El tipo de enemigo sale de `types` según el minuto (el último cuyo `from` se ha pasado). El anillo es un cerco de
 * varios roles (CAMBIOS §4): sale de `mix` (pesos por tipo según el minuto) y siempre deja una salida.
 */
/**
 * Valores en `src/data/tuning.json` → `hordes`. Notas por campo:
 * - `margin`: Margen fuera de cámara donde aparecen, en px de mundo.
 * - `ring.gap`: Anchura (rad) de la salida libre del cerco. `ring.heavyEvery`: un pesado cada tantos puestos.
 * - `ring.mix`: Pesos por tipo; vale la última entrada cuyo `from` (s) se ha pasado. Pesado = rol `heavy`.
 * - `stampede.width`: Anchura del rebaño (perpendicular a la marcha) y separación entre filas.
 * - `wall.extra`: Segundos extra de marcha en formación tras llegar a la altura del jugador.
 */
type HordeTypes = { types: readonly { from: number; type: StatEnemyId }[] };
export type RingMix = readonly { from: number; types: Partial<Record<StatEnemyId, number>> }[];
export const HORDES = T.hordes as Retype<
  typeof T.hordes,
  { order: readonly HordeKind[]; ring: { mix: RingMix }; stampede: HordeTypes; wall: HordeTypes }
>;

export type HordeKind = 'ring' | 'stampede' | 'wall';
