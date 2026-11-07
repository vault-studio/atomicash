// Oleadas de cada acto (02_GAMEPLAY.md §5). Cada entrada rige, dentro de su acto, desde `from` hasta la siguiente.
import type { ActId } from './acts';
import { TUNING as T, type DeepReadonly } from './tuning';
import type { StatEnemyId } from './enemies';

export interface WaveDef {
  /** Acto al que pertenece. */
  readonly act: ActId;
  /** Segundo del acto en que empieza. */
  readonly from: number;
  /** Enemigos que aparecen por segundo. */
  readonly rate: number;
  /** Máximo de enemigos vivos; si se alcanza, no aparecen más hasta que mueran. */
  readonly max: number;
  /** Pesos relativos de cada tipo. */
  readonly mix: Readonly<Partial<Record<StatEnemyId, number>>>;
}

/**
 * Valores en `src/data/tuning.json` → `waves`: lista plana, tres entradas por acto (segundos 0, 60 y 120 del acto; la
 * última rige con el jefe en el mapa). Las mezclas solo llevan enemigos de su acto (`ENTITIES[id].act`); cada rol se
 * desbloquea en su segundo (`CAMPAIGN.gates`), así que un tipo aún bloqueado de la mezcla simplemente no sale.
 */
export const WAVES = T.waves as readonly WaveDef[];

/**
 * Valores en `src/data/tuning.json` → `spawn`. Notas por campo:
 * - `minDist`: Distancia mínima al jugador, en px de mundo, aunque la cámara vea menos.
 * - `offscreenMargin`: Margen extra fuera del borde de la cámara, en px de mundo.
 * - `jitter`: Variación aleatoria añadida a la distancia (siempre hacia fuera).
 * - `relocateDist`: Los enemigos más lejos que esto vuelven a aparecer cerca, fuera de cámara (no aplica a
 *   jefes).
 * - `staticMin`: Las torretas aparecen ya dentro de este anillo (no se mueven).
 * - `bossRateMult`: Con un jefe vivo las oleadas van a este ritmo (eventos, élites, hordas y guarniciones esperan).
 *   DECISIÓN del usuario: a la mitad; sin ningún enemigo le parecía excesivo.
 * - `rateMult`: Multiplicador global del ritmo de aparición de todas las oleadas. DECISIÓN: menos enemigos que
 *   dan mucha más experiencia (XP.killMult): se sube de nivel más a menudo con menos agobio en pantalla, ahora que
 *   la cámara está más cerca.
 * - `maxSlime`: Rastros de babosa simultáneos (cada uno dura `AI.babosa.trailLife`).
 */
export const SPAWN: DeepReadonly<typeof T.spawn> = T.spawn;

/**
 * Valores en `src/data/tuning.json` → `events`:
 * - `bossQuiet`: s de silencio tras un jefe para el evento «Tú mismo, otra vez».
 * - `supply`: lo que dan las cajas de suministros.
 * - `rain`: lluvia radiactiva (uno de los eventos especiales): duración, más enemigos y más experiencia.
 */
export const EVENTS: DeepReadonly<typeof T.events> = T.events;

/**
 * Hordas en formación (dossier §10), con aviso en el borde de la pantalla `warn` s antes:
 * - `ring`: anillo que se cierra desde fuera de cámara.
 * - `stampede`: estampida que cruza la pantalla en línea recta (apunta a donde estabas).
 * - `wall`: muro que avanza en formación hacia el jugador y luego persigue.
 * El anillo es un cerco de varios roles (CAMBIOS §4): sale de `mix` (pesos por tipo de su acto) y siempre deja una
 * salida. Estampida y muro usan el primer tipo de `types` de su acto que pueda salir ya.
 */
/**
 * Valores en `src/data/tuning.json` → `hordes`. Notas por campo:
 * - `margin`: Margen fuera de cámara donde aparecen, en px de mundo.
 * - `ring.gap`: Anchura (rad) de la salida libre del cerco. `ring.heavyEvery`: un pesado cada tantos puestos.
 * - `ring.mix`: Pesos por tipo y acto, solo con tipos del acto. Pesado = rol `heavy`.
 * - `ring.actCount`: Multiplica los puestos del cerco en cada acto: los normales de los actos 2 y 3 son mucho más duros.
 * - `stampede.width`: Anchura del rebaño (perpendicular a la marcha) y separación entre filas.
 * - `stampede.types`, `wall.types`: Por acto, tipos por orden de preferencia; `count` multiplica cuántos salen
 *   (los duros salen menos). El último de cada lista debe estar desbloqueado desde el segundo 0.
 * - `wall.extra`: Segundos extra de marcha en formación tras llegar a la altura del jugador.
 */
export interface HordeType {
  readonly type: StatEnemyId;
  readonly count: number;
}
type ActTypes = { readonly types: Readonly<Record<ActId, readonly HordeType[]>> };
export type RingMix = Readonly<Record<ActId, Readonly<Partial<Record<StatEnemyId, number>>>>>;
type Raw = typeof T.hordes;
export const HORDES = T.hordes as unknown as DeepReadonly<
  Omit<Raw, 'order' | 'ring' | 'stampede' | 'wall'>
> & {
  readonly order: readonly HordeKind[];
  readonly ring: DeepReadonly<Omit<Raw['ring'], 'mix'>> & { readonly mix: RingMix };
  readonly stampede: DeepReadonly<Omit<Raw['stampede'], 'types'>> & ActTypes;
  readonly wall: DeepReadonly<Omit<Raw['wall'], 'types'>> & ActTypes;
};

export type HordeKind = 'ring' | 'stampede' | 'wall';
