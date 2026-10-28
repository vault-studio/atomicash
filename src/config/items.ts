// Objetos equipables (2 huecos, los dan los jefes) y consumibles (4 huecos). Textos en i18n (`items.<id>`, `consumables.<id>`).

export interface ItemDef {
  readonly luck?: number;
  /** Multiplicador de RAD recibida. */
  readonly radGain?: number;
  readonly speed?: number;
  readonly magnet?: number;
  readonly cd?: number;
  readonly dmg?: number;
  readonly hpMult?: number;
}

/**
 * Objetos de jefe: el Rey Rata y el Dirigible sueltan un cofre con 3 a elegir.
 * DECISIÓN: bonificaciones fuertes (el doble o más que un rasgo raro) porque solo hay dos en toda la partida.
 */
export const ITEMS = {
  dice: { luck: 40 },
  apron: { radGain: 0.4 },
  skates: { speed: 0.35 },
  fridge: { magnet: 1.5 },
  belt: { cd: 0.3 },
  bobble: { dmg: 0.5, hpMult: 0.85 },
} as const satisfies Record<string, ItemDef>;

export type ItemId = keyof typeof ITEMS;
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];

export const CONSUMABLES = {
  stim: { heal: 0.4 },
  iodine: { rad: 50 },
  grenade: { r: 200, dmg: 150, range: 700 },
  turbo: { dur: 8, mult: 1.4 },
} as const;

export type ConsumableId = keyof typeof CONSUMABLES;
/** Orden de los huecos (teclas 5–8). */
export const CONSUMABLE_IDS: readonly ConsumableId[] = ['stim', 'iodine', 'grenade', 'turbo'];

export const DROPS = {
  /** Probabilidad de que un enemigo suelte un estimulante (la suerte la sube: × (1 + suerte/50)). */
  stimChance: 0.004,
} as const;

export type FieldPickupId = 'medkit' | 'magnet' | 'bomb';

/**
 * Recogibles de campo: los suelta al azar un enemigo al morir y se usan al tocarlos.
 * DECISIÓN: botiquín el más frecuente, luego imán y la bomba la más rara (pesos 6 : 3 : 1).
 */
export const FIELD_PICKUPS = {
  /** Probabilidad de que una baja suelte uno (la suerte la sube como a los estimulantes). */
  chance: 0.006,
  weights: { medkit: 6, magnet: 3, bomb: 1 } as Readonly<Record<FieldPickupId, number>>,
  /** Radio del objeto en el suelo. */
  r: 9,
  /** Fracción de la vida máxima que cura el botiquín. */
  medkitHeal: 0.3,
  /** Daño de la bomba a los jefes (al resto los mata). */
  bombBossDmg: 400,
} as const;

export const FIELD_PICKUP_IDS: readonly FieldPickupId[] = ['medkit', 'magnet', 'bomb'];
