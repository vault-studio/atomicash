// Balance de los supervivientes. Los valores vienen del prototipo (atomic-ash-proto.html).
// DECISIÓN: los IDs son los de la biblia de arte (dot, mae, errante, benny), no los de 03_CONTENT.md
// (mechanic, nurse, courier), porque la biblia es más reciente y fija las rutas de los assets.
import type { PropId, SurvivorId } from './entities';

export interface SurvivorStats {
  readonly hp: number;
  /** px/s */
  readonly speed: number;
  readonly weapon: PropId;
  readonly exclusiveWeapon: PropId;
  /** Pasivas (02_GAMEPLAY.md §2). Textos en i18n `passives.<id>`. */
  readonly meleePct?: number;
  /** PV/s */
  readonly regen?: number;
  /** Multiplicador de la RAD recibida. */
  readonly radGain?: number;
  readonly speedPct?: number;
  readonly magnetPct?: number;
}

export const SURVIVORS = {
  dot: { hp: 100, speed: 200, weapon: 'llave', exclusiveWeapon: 'martillo_pilon', meleePct: 0.15 },
  mae: { hp: 110, speed: 190, weapon: 'jeringa', exclusiveWeapon: 'desfibrilador', regen: 0.5 },
  errante: {
    hp: 120,
    speed: 205,
    weapon: 'escopeta_chatarra',
    exclusiveWeapon: 'nucleo_cobalto',
    radGain: 0.7,
  },
  benny: {
    hp: 90,
    speed: 230,
    weapon: 'pistola_clavos',
    exclusiveWeapon: 'petardos',
    speedPct: 0.1,
    magnetPct: 0.2,
  },
} as const satisfies Partial<Record<SurvivorId, SurvivorStats>>;

export const survivorStats = (id: StatSurvivorId): SurvivorStats => SURVIVORS[id];

export type StatSurvivorId = keyof typeof SURVIVORS;

export function hasStats(id: SurvivorId): id is StatSurvivorId {
  return Object.prototype.hasOwnProperty.call(SURVIVORS, id);
}
