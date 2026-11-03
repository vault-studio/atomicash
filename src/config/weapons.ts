// Armas y fusiones («Apaño»). Valores de partida del prototipo; nombres y textos en i18n (`weapons.<id>`).
// DECISIÓN: se usan las armas del prototipo y de la biblia de arte en vez de la tabla de 03_CONTENT.md.
// Para llegar a 12+ armas se añaden `megafono` y `rifle_cerrojo`, y dos fusiones nuevas
// (`nucleo_inestable`, `dardos_incendiarios`) para completar las 4 del MVP.
import { TUNING as T, type RetypeEach } from './tuning';

export type WeaponKind =
  | 'orbit'
  | 'bullet'
  | 'fan'
  | 'shotgun'
  | 'lob'
  | 'chain'
  | 'aura'
  | 'slam'
  | 'mines'
  | 'zap'
  | 'orb'
  | 'cone'
  | 'rifle'
  | 'unstable'
  | 'firedarts';

export interface WeaponBase {
  readonly kind: WeaponKind;
  /** Exclusiva de un superviviente. */
  readonly owner?: string;
  readonly fusion?: boolean;
  /** Recibe el bonus de cuerpo a cuerpo. */
  readonly melee?: boolean;
  /** Color del placeholder y de los proyectiles. */
  readonly color: string;
  /** Blindaje que ignora cada impacto (ver `applyArmor`). */
  readonly armorPierce?: number;
}

/**
 * Valores en `src/data/tuning.json` → `weapons`. Notas por campo:
 * - `coctel.lead`: El charco cae esta distancia por delante del objetivo, hacia el jugador (como mucho a medio
 *   camino).
 * - `coctel.burn`: Quemadura: quien pisa el charco (o sigue dentro `stay` s más) coge una de hasta `stacks`, que
 *   dura `dur` s y le hace `dps` (con `dmgPerLvl`) cada segundo. Con todas puestas, una nueva renueva la que antes
 *   se acaba.
 * - `martillo_pilon`: Exclusivas
 * - `petardos`: Ristra lanzada: cada `cd` s lanza en arco una ristra al grupo más denso a `range`; los petardos
 *   caen desperdigados en `spread` y revientan en cadena, uno cada `chain` s, con empuje y un aturdimiento breve (no
 *   a los jefes). DECISIÓN: muchos estallidos pequeños que se solapan en vez de uno grande, para que suene y se vea
 *   a traca.
 * - `petardos.count`: Petardos por ristra en cada nivel (1–5).
 * - `petardos.samples`: Candidatos que se comparan para elegir el grupo más denso, y radio en que se cuentan
 *   vecinos.
 * - `dinamo`: Fusiones
 */
export const WEAPONS = T.weapons as RetypeEach<typeof T.weapons, { kind: WeaponKind }>;

export type WeaponId = keyof typeof WEAPONS;
export const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[];

export interface FusionDef {
  readonly a: WeaponId;
  readonly b: WeaponId;
  readonly result: WeaponId;
}

export const FUSIONS: readonly FusionDef[] = [
  { a: 'llave', b: 'tesla', result: 'dinamo' },
  { a: 'pistola_clavos', b: 'escopeta_chatarra', result: 'remachadora' },
  { a: 'geiger', b: 'megafono', result: 'nucleo_inestable' },
  { a: 'jeringa', b: 'coctel', result: 'dardos_incendiarios' },
];

/** Daño al nivel `lvl` para armas con `dmgPerLvl` (+x por nivel sobre el base). */
export const scaled = (base: number, perLvl: number, lvl: number): number => base * (1 + perLvl * (lvl - 1));

/** Fuentes de daño para las estadísticas: armas, consumibles y efectos. */
export const DAMAGE_SOURCES = [...WEAPON_IDS, 'granada', 'hinchado', 'bomba', 'barril'] as const;
export type DamageSource = (typeof DAMAGE_SOURCES)[number];
export const SOURCE_INDEX: Readonly<Record<string, number>> = Object.fromEntries(
  DAMAGE_SOURCES.map((s, i) => [s, i]),
);
