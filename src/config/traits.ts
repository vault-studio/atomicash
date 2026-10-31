// Rasgos (mejoras pasivas de la subida de nivel) y reglas de las tarjetas. Textos en i18n (`traits.<id>`).

export type Rarity = 'common' | 'rare' | 'epic';

export type StatKey =
  | 'dmg'
  | 'spd'
  | 'xp'
  | 'red'
  | 'armor'
  | 'regen'
  | 'mag'
  | 'dodge'
  | 'crit'
  | 'critDmg'
  | 'hp'
  | 'cd'
  | 'radDecay'
  | 'area'
  | 'pierce'
  | 'adren'
  | 'luck'
  | 'kb';

export interface TraitDef {
  readonly stat: StatKey;
  /** Valor de una tarjeta común (las raras y épicas lo multiplican). */
  readonly base: number;
  /** Tope acumulado del stat. */
  readonly max: number;
  /** Stats enteros: el valor sale de `intVals` según la rareza. */
  readonly int?: boolean;
  readonly intVals?: Readonly<Record<Rarity, number>>;
  /** Peso al sortear las tarjetas de rasgo (por defecto `CARDS.traitBaseWeight`). */
  readonly weight?: number;
}

export const TRAITS = {
  ammo: { stat: 'dmg', base: 8, max: 120 },
  boots: { stat: 'spd', base: 6, max: 40 },
  manual: { stat: 'xp', base: 10, max: 60 },
  // Defensas: con golpes de 16–20 PV son las que deciden si aguantas; salen el triple de a menudo que el resto.
  helmet: { stat: 'red', base: 8, max: 40, weight: 3 },
  plate: { stat: 'armor', base: 2, max: 8, int: true, intVals: { common: 2, rare: 3, epic: 4 }, weight: 3 },
  suture: { stat: 'regen', base: 0.5, max: 2.5, weight: 3 },
  magnet: { stat: 'mag', base: 25, max: 150 },
  cat: { stat: 'dodge', base: 4, max: 35 },
  scope: { stat: 'crit', base: 5, max: 50 },
  // Daño de los críticos: +25 % por común sobre el ×2 base, hasta ×4. Vale poco sin `scope`, por eso sale menos.
  hollow: { stat: 'critDmg', base: 25, max: 200, weight: 0.7 },
  ration: { stat: 'hp', base: 20, max: 200 },
  oil: { stat: 'cd', base: 6, max: 60 },
  iodine: { stat: 'radDecay', base: 1, max: 4 },
  fuse: { stat: 'area', base: 10, max: 60 },
  tips: { stat: 'pierce', base: 1, max: 3, int: true, intVals: { common: 1, rare: 1, epic: 2 } },
  adren: { stat: 'adren', base: 15, max: 60 },
  rabbit: { stat: 'luck', base: 6, max: 40 },
  stock: { stat: 'kb', base: 25, max: 100 },
} as const satisfies Record<string, TraitDef>;

export type TraitId = keyof typeof TRAITS;
export const TRAIT_IDS = Object.keys(TRAITS) as TraitId[];

export const CARDS = {
  count: 3,
  /** Probabilidad de que un hueco de tarjeta sea de arma (si hay armas disponibles). */
  weaponChance: 0.75,
  upWeight: 3,
  newWeight: 2.2,
  /** Umbrales de rareza sobre una tirada 0–100 (la suerte acorta la tirada). */
  epic: 7,
  rare: 28,
  minRoll: 20,
  rarityMult: { common: 1, rare: 1.5, epic: 2.2 } as Readonly<Record<Rarity, number>>,
  intVals: { common: 1, rare: 2, epic: 3 } as Readonly<Record<Rarity, number>>,
  traitBaseWeight: 1,
  /** Cada vez que eliges un rasgo, sale más a menudo (construcciones con identidad). */
  traitPickBonus: 0.75,
  /** No ofrecer el mismo rasgo si se ha elegido N veces seguidas. */
  traitStreakBlock: 2,
  /** Si no queda nada que ofrecer: botiquín (% de PV) y lavado químico (RAD). */
  fallbackHeal: 0.3,
  fallbackPurge: 30,
} as const;
