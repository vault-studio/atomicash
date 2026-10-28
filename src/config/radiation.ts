// Radiación (02_GAMEPLAY.md §6): sube en charcos, rastros y lluvia; da daño a cambio de vida.

export interface RadTier {
  readonly min: number;
  /** Bonus de daño. */
  readonly dmg: number;
  /** Penalización de PV máximos. */
  readonly hpPen: number;
  /** Probabilidad extra de enemigos irradiados. */
  readonly irr: number;
  /** PV perdidos por segundo. */
  readonly drain: number;
  readonly color: string;
}

export const RAD = {
  max: 100,
  /** RAD/s dentro de un charco. */
  puddle: 7,
  /** RAD/s durante la lluvia radiactiva. */
  rain: 2.4,
  /** RAD/s que bajan solos tras `decayDelay` s sin recibir radiación. */
  decay: 1.5,
  decayDelay: 3,
  tiers: [
    { min: 0, dmg: 0, hpPen: 0, irr: 0, drain: 0, color: '#7a8a6a' },
    { min: 30, dmg: 0.1, hpPen: 0.05, irr: 0, drain: 0, color: '#b6d64a' },
    { min: 60, dmg: 0.25, hpPen: 0.15, irr: 0.15, drain: 0, color: '#7dff3a' },
    { min: 90, dmg: 0.4, hpPen: 0.15, irr: 0.15, drain: 1, color: '#c8ff00' },
  ] as readonly RadTier[],
} as const;

/**
 * Charcos radiactivos fijos del mapa: cada uno es una casilla del suelo con un lago de ácido pintado.
 * DECISIÓN: antes eran 45 círculos de radio 55–110 en cualquier sitio; ahora van pegados a casillas, en dos tamaños
 * que corresponden a los dos lagos pintados (pequeño y grande), y hay 60: algunos más que objetos de decoración.
 */
export const HAZARDS = {
  count: 60,
  /**
   * Radios posibles del daño en fracción del lado de la casilla, de menor a mayor; el render pinta el lago que
   * corresponde a cada uno (el pequeño ocupa ~media cara, el grande casi toda).
   */
  cellRadii: [0.25, 0.42] as readonly number[],
  /** Radio libre alrededor del punto de inicio. */
  safe: 350,
} as const;

/** Variante irradiada de cualquier enemigo normal: más PV, golpe con RAD y doble chatarra. */
export const IRRADIATED = {
  base: 0.04,
  perSec: 1 / 9000,
  hp: 1.5,
  rad: 3,
  xp: 2,
} as const;

export function radTier(rad: number): RadTier {
  let t = RAD.tiers[0]!;
  for (const x of RAD.tiers) if (rad >= x.min) t = x;
  return t;
}
