// Balance de los supervivientes. Los valores vienen del prototipo (atomic-ash-proto.html).
// DECISIÓN: los IDs son los de la biblia de arte (dot, mae, errante, benny), no los de 03_CONTENT.md
// (mechanic, nurse, courier), porque la biblia es más reciente y fija las rutas de los assets.
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

export const SURVIVORS = {
  dot: {
    hp: 100,
    speed: 200,
    rarity: 'common',
    weapon: 'pistola_clavos',
    exclusiveWeapon: 'martillo_pilon',
    meleePct: 0.15,
  },
  mae: {
    hp: 110,
    speed: 190,
    rarity: 'common',
    weapon: 'jeringa',
    exclusiveWeapon: 'desfibrilador',
    regen: 0.5,
  },
  errante: {
    hp: 120,
    speed: 205,
    rarity: 'common',
    weapon: 'escopeta_chatarra',
    exclusiveWeapon: 'nucleo_cobalto',
    radGain: 0.7,
  },
  benny: {
    hp: 90,
    speed: 230,
    rarity: 'common',
    weapon: 'pistola_clavos',
    exclusiveWeapon: 'petardos',
    speedPct: 0.1,
    magnetPct: 0.2,
  },
  // DECISIÓN: 03_CONTENT.md da a Gus una sartén y a Ilse un rayo que aún no existen; usan el cóctel y el
  // Geiger hasta que haya arte y diseño de esas armas.
  silas: { hp: 100, speed: 210, rarity: 'rare', weapon: 'rifle_cerrojo', bossPct: 0.2 },
  gus: { hp: 130, speed: 180, rarity: 'rare', weapon: 'coctel', consDurPct: 0.5 },
  ilse: { hp: 85, speed: 200, rarity: 'epic', weapon: 'geiger', radDmgMult: 2 },
  kip: { hp: 150, speed: 170, rarity: 'epic', weapon: 'tesla', radImmune: true },
  rosalind: { hp: 120, speed: 200, rarity: 'legendary', weapon: 'megafono', extraWeaponSlots: 1 },
} as const satisfies Record<SurvivorId, SurvivorStats>;

export const survivorStats = (id: StatSurvivorId): SurvivorStats => SURVIVORS[id];

export type StatSurvivorId = keyof typeof SURVIVORS;

export function hasStats(id: SurvivorId): id is StatSurvivorId {
  return Object.prototype.hasOwnProperty.call(SURVIVORS, id);
}

/** Huecos de arma en la run (Rosalind lleva uno más). */
export const weaponSlots = (id: StatSurvivorId, base: number): number =>
  base + ((SURVIVORS[id] as SurvivorStats).extraWeaponSlots ?? 0);

export const STAT_SURVIVOR_IDS = Object.keys(SURVIVORS) as StatSurvivorId[];
