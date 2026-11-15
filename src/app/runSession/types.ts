// Tipos de la sesión de partida: opciones, ajustes, callbacks a la UI y controles.
import type { Choice, InputState, World } from '../../engine/types';
import { type RunResults, type WorldOptions } from '../../engine/world';
import { type StatSurvivorId } from '../../config/survivors';
import type { HudSnapshot } from './snapshot';

/** Móvil (puntero grueso) en vertical. Es la misma condición que muestra el aviso `.rotate` en CSS. */
export const PORTRAIT_QUERY = '(orientation: portrait) and (pointer: coarse)';

export interface RunCallbacks {
  onHud: (s: HudSnapshot) => void;
  onChoice: (c: Choice | null) => void;
  onEnd: (r: RunResults) => void;
}

export interface RunSettings {
  showDamage: boolean;
  reduceMotion: boolean;
  /** Filtro de pantalla vieja sobre el juego. */
  crt: boolean;
}

/**
 * Sustituye a la entrada del jugador en cada paso fijo (depurador, piloto automático). Devuelve `true` si ha rellenado
 * `out`; con `false` se usa la entrada normal.
 */
export type InputOverride = (w: World, out: InputState) => boolean;

export interface RunSession {
  readonly world: World;
  choose(i: number): void;
  reroll(): void;
  banish(i: number): void;
  lock(i: number): void;
  consume(i: number): void;
  setPaused(p: boolean): void;
  /** Escala el tiempo que recibe el paso fijo (1 = normal, 0 = congelado). Para el depurador. */
  setSpeed(mult: number): void;
  /** Fase de test: saca al Coloso cerca del jugador. */
  spawnColossus(): void;
  apply(settings: RunSettings): void;
  dispose(): void;
}

export interface RunOptions extends WorldOptions {
  charId: StatSurvivorId;
  seed: number;
  settings: RunSettings;
  /** Si existe, sustituye a la entrada del jugador (depurador). */
  inputOverride?: InputOverride;
}
