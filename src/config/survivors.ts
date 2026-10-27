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
}

export const SURVIVORS = {
  dot: { hp: 100, speed: 200, weapon: 'llave', exclusiveWeapon: 'martillo_pilon' },
  mae: { hp: 110, speed: 190, weapon: 'jeringa', exclusiveWeapon: 'desfibrilador' },
  errante: { hp: 120, speed: 205, weapon: 'escopeta_chatarra', exclusiveWeapon: 'nucleo_cobalto' },
  benny: { hp: 90, speed: 230, weapon: 'pistola_clavos', exclusiveWeapon: 'petardos' },
} as const satisfies Partial<Record<SurvivorId, SurvivorStats>>;

export type StatSurvivorId = keyof typeof SURVIVORS;

export function hasStats(id: SurvivorId): id is StatSurvivorId {
  return Object.prototype.hasOwnProperty.call(SURVIVORS, id);
}
