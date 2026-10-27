// Objetos equipables (1 hueco) y consumibles (4 huecos). Textos en i18n (`items.<id>`, `consumables.<id>`).

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

export const ITEMS = {
  dice: { luck: 15 },
  apron: { radGain: 0.6 },
  skates: { speed: 0.2 },
  fridge: { magnet: 0.6 },
  belt: { cd: 0.15 },
  bobble: { dmg: 0.25, hpMult: 0.85 },
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
