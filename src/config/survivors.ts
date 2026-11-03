// Balance de los supervivientes. Los valores vienen del prototipo (atomic-ash-proto.html).
// DECISIÓN: los IDs son los de la biblia de arte (dot, mae, errante, benny), no los de 03_CONTENT.md
// (mechanic, nurse, courier), porque la biblia es más reciente y fija las rutas de los assets.
import { TUNING as T } from './tuning';
import type { SurvivorId } from './entities';
import type { WeaponId } from './weapons';

/** Rareza de colección (02_GAMEPLAY.md §9): borde gris / azul / morado / dorado. */
export type SurvivorRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface SurvivorStats {
  readonly hp: number;
  /** px/s */
  readonly speed: number;
  readonly rarity: SurvivorRarity;
  readonly weapon: WeaponId;
  /** Arma propia que solo él puede encontrar en la run. */
  readonly exclusiveWeapon?: WeaponId;
  /** Pasivas (02_GAMEPLAY.md §2). Textos en i18n `passives.<id>`. */
  readonly meleePct?: number;
  /** PV/s */
  readonly regen?: number;
  /** Multiplicador de la RAD recibida. */
  readonly radGain?: number;
  readonly speedPct?: number;
  readonly magnetPct?: number;
  /** Daño extra a jefes. */
  readonly bossPct?: number;
  /** Duración extra de los consumibles. */
  readonly consDurPct?: number;
  /** Multiplicador del bonus de daño de la RAD. */
  readonly radDmgMult?: number;
  /** Sin pérdida de PV en el tramo máximo de RAD. */
  readonly radImmune?: boolean;
  readonly extraWeaponSlots?: number;
}

/**
 * Valores en `src/data/tuning.json` → `survivors`. Notas por campo:
 * - `silas`: DECISIÓN: 03_CONTENT.md da a Gus una sartén y a Ilse un rayo que aún no existen; usan el cóctel y
 *   el Geiger hasta que haya arte y diseño de esas armas.
 */
export const SURVIVORS: Readonly<Record<keyof typeof T.survivors, SurvivorStats>> = T.survivors as Record<
  keyof typeof T.survivors,
  SurvivorStats
>;

export const survivorStats = (id: StatSurvivorId): SurvivorStats => SURVIVORS[id];

export type StatSurvivorId = keyof typeof SURVIVORS;

export function hasStats(id: SurvivorId): id is StatSurvivorId {
  return Object.prototype.hasOwnProperty.call(SURVIVORS, id);
}

/** Huecos de arma en la run (Rosalind lleva uno más). */
export const weaponSlots = (id: StatSurvivorId, base: number): number =>
  base + ((SURVIVORS[id] as SurvivorStats).extraWeaponSlots ?? 0);

export const STAT_SURVIVOR_IDS = Object.keys(SURVIVORS) as StatSurvivorId[];

/**
 * Supervivientes que hay ahora en el juego: test inicial, caja y colección.
 * DECISIÓN: por ahora solo los tres con arte completo (Dot, Gus el cocinero y Benny el mensajero); el resto
 * conserva sus stats para cuando tenga sprites.
 */
export const ROSTER = ['dot', 'gus', 'benny'] as const satisfies readonly StatSurvivorId[];
