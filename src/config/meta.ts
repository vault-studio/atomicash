// Meta-progresión del Búnker (02_GAMEPLAY.md §8–9): colección, taller, mercader, cajas, misiones y logros.
import type { ConsumableId } from './items';
import type { StatKey } from './traits';
import { ROSTER, SURVIVORS, type StatSurvivorId, type SurvivorRarity } from './survivors';
import type { WeaponId } from './weapons';

export const RARITIES: readonly SurvivorRarity[] = ['common', 'rare', 'epic', 'legendary'];

/** Supervivientes iniciales del perfil psicológico: los tres del plantel (mecánica, cocinero y mensajero). */
export const STARTERS = ROSTER;
export type StarterId = (typeof STARTERS)[number];

/** Test del Ministerio: la respuesta i de cada pregunta suma un punto a `STARTERS[i]`. Textos en `psych.q<n>`. */
export const PSYCH = { questions: 6 } as const;

export const SURVIVOR_LEVEL = {
  max: 30,
  /** XP del superviviente para pasar del nivel n al n+1. */
  next: (n: number): number => 60 + n * 40,
  /** XP ganada en una run: por segundo sobrevivido, por baja y por jefe. */
  perSec: 0.5,
  perKill: 0.05,
  perBoss: 60,
  /** Cada nivel por encima del 1: +PV planos y +% de daño. */
  hpPerLevel: 1,
  dmgPerLevel: 1,
} as const;

export const STARS = {
  max: 5,
  /** Cada estrella por encima de la primera: +5 % a los stats base (PV, daño, velocidad). */
  pctPerStar: 5,
  /** Fichas para pasar de n a n+1 estrellas (índice n−1). */
  cost: [5, 10, 20, 40] as readonly number[],
  /** Fichas que da un duplicado según su rareza. */
  shardsPerDup: { common: 1, rare: 2, epic: 4, legendary: 8 } satisfies Record<SurvivorRarity, number>,
} as const;

/** Variante irradiada (shiny): solo cosmética. */
export const IRRADIATED_PULL = 0.01;

export type UpgradeId = 'hp' | 'dmg' | 'spd' | 'mag' | 'reroll' | 'cons';
export interface UpgradeDef {
  readonly max: number;
  readonly cost: number;
  /** Multiplicador del coste por nivel comprado. */
  readonly growth: number;
  /** Stat de rasgo al que suma, y cuánto por nivel. `reroll` y `cons` se aplican aparte. */
  readonly stat?: StatKey;
  readonly per: number;
}
export const UPGRADES = {
  hp: { max: 5, cost: 60, growth: 1.6, stat: 'hp', per: 8 },
  dmg: { max: 5, cost: 80, growth: 1.6, stat: 'dmg', per: 5 },
  spd: { max: 5, cost: 60, growth: 1.6, stat: 'spd', per: 3 },
  mag: { max: 3, cost: 50, growth: 1.7, stat: 'mag', per: 15 },
  reroll: { max: 2, cost: 150, growth: 2.2, per: 1 },
  /** Un consumible más de cada tipo al salir. */
  cons: { max: 2, cost: 120, growth: 2, per: 1 },
} as const satisfies Record<UpgradeId, UpgradeDef>;
export const UPGRADE_IDS = Object.keys(UPGRADES) as UpgradeId[];
export const upgradeCost = (id: UpgradeId, lvl: number): number =>
  Math.round(UPGRADES[id].cost * Math.pow(UPGRADES[id].growth, lvl));

/** Implantes: +10 % a un stat y −5 % a otro (los PV son planos). Uno por superviviente. */
export type ImplantId = 'cortex' | 'piernas' | 'pulmon' | 'iman' | 'reflejos' | 'blindaje';
export interface ImplantDef {
  readonly up: StatKey;
  readonly upVal: number;
  readonly down: StatKey;
  readonly downVal: number;
  readonly price: number;
}
export const IMPLANTS = {
  cortex: { up: 'dmg', upVal: 10, down: 'spd', downVal: -5, price: 400 },
  piernas: { up: 'spd', upVal: 10, down: 'hp', downVal: -5, price: 350 },
  pulmon: { up: 'hp', upVal: 10, down: 'dmg', downVal: -5, price: 350 },
  iman: { up: 'mag', upVal: 10, down: 'armor', downVal: -1, price: 300 },
  reflejos: { up: 'cd', upVal: 10, down: 'hp', downVal: -5, price: 450 },
  blindaje: { up: 'red', upVal: 10, down: 'spd', downVal: -5, price: 450 },
} as const satisfies Record<ImplantId, ImplantDef>;
export const IMPLANT_IDS = Object.keys(IMPLANTS) as ImplantId[];

export const MERCHANT = {
  /** Ofertas por día. */
  consumables: 3,
  implants: 2,
  manuals: 2,
  consumablePrice: { stim: 40, iodine: 30, grenade: 50, turbo: 60 } satisfies Record<ConsumableId, number>,
  /** Unidades por oferta de consumible. */
  consumablePack: 2,
  manualPrice: 600,
  /** Armas que pueden enseñar los manuales (no fusiones ni exclusivas). */
  manualWeapons: [
    'llave',
    'pistola_clavos',
    'jeringa',
    'coctel',
    'tesla',
    'geiger',
    'escopeta_chatarra',
    'megafono',
    'rifle_cerrojo',
  ] as readonly WeaponId[],
} as const;

export const BACKPACK = {
  /** Consumibles iniciales de una cuenta nueva. */
  start: { stim: 2, iodine: 2, grenade: 3, turbo: 1 } satisfies Record<ConsumableId, number>,
  /** Máximo de cada tipo que se lleva a una run. */
  perRun: 3,
} as const;

export type ZoneId = 'paramo';
export const ZONE_IDS: readonly ZoneId[] = ['paramo'];

export const GACHA = {
  /** Probabilidades visibles en pantalla (obligatorio). Suman 1. */
  rates: { common: 0.7, rare: 0.24, epic: 0.05, legendary: 0.01 } satisfies Record<SurvivorRarity, number>,
  /** Legendario asegurado tras este número de tiradas seguidas sin legendario. */
  pity: 90,
  /** Coste por tamaño de tirada. ×10 garantiza al menos un raro. */
  cost: { 1: 100, 10: 900, 100: 8500 } as const,
  /** Personajes de la caja de cada zona. */
  pool: {
    paramo: ROSTER,
  } satisfies Record<ZoneId, readonly StatSurvivorId[]>,
} as const;
export type PullSize = keyof typeof GACHA.cost;

const poolOf = (zone: ZoneId): readonly StatSurvivorId[] => GACHA.pool[zone];

/** Rarezas que tiene la caja de una zona, de menor a mayor. */
export const zoneRarities = (zone: ZoneId): SurvivorRarity[] =>
  RARITIES.filter((r) => poolOf(zone).some((id) => SURVIVORS[id].rarity === r));

/** La mejor rareza de la caja: la que asegura la garantía. */
export const topRarity = (zone: ZoneId): SurvivorRarity => zoneRarities(zone).at(-1) ?? 'common';

/**
 * Probabilidades reales de cada rareza en la caja de una zona: la de una rareza sin personajes pasa a la siguiente
 * que haya por debajo, como al sacar (o a la más baja que haya si no hay ninguna por debajo).
 */
export function zoneRates(zone: ZoneId): Record<SurvivorRarity, number> {
  const have = zoneRarities(zone);
  const out: Record<SurvivorRarity, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
  for (const r of RARITIES) {
    const lower = have.filter((h) => RARITIES.indexOf(h) <= RARITIES.indexOf(r)).at(-1) ?? have[0] ?? 'common';
    out[lower] += GACHA.rates[r];
  }
  return out;
}
export const PULL_SIZES: readonly PullSize[] = [1, 10, 100];

/** Misiones diarias (3 al día, se reinician a medianoche local). */
export type MissionKind = 'kills' | 'surviveMin' | 'runs' | 'bosses' | 'surviveWith' | 'consumables';
export interface MissionDef {
  readonly kind: MissionKind;
  readonly goal: number;
  readonly reward: number;
}
export const MISSIONS = {
  kills500: { kind: 'kills', goal: 500, reward: 120 },
  kills1500: { kind: 'kills', goal: 1500, reward: 250 },
  survive5: { kind: 'surviveMin', goal: 5, reward: 100 },
  survive10with: { kind: 'surviveWith', goal: 10, reward: 250 },
  runs3: { kind: 'runs', goal: 3, reward: 100 },
  boss1: { kind: 'bosses', goal: 1, reward: 150 },
  cons5: { kind: 'consumables', goal: 5, reward: 80 },
} as const satisfies Record<string, MissionDef>;
export type MissionId = keyof typeof MISSIONS;
export const MISSION_IDS = Object.keys(MISSIONS) as MissionId[];
export const DAILY_COUNT = 3;

/** Logros permanentes. DECISIÓN: sin cosméticos todavía; dan créditos y fichas del superviviente activo. */
export type AchievementKind =
  'totalKills' | 'win' | 'bossesTotal' | 'collection' | 'survivorLevel' | 'irradiated';
export interface AchievementDef {
  readonly kind: AchievementKind;
  readonly goal: number;
  readonly credits: number;
  readonly shards: number;
}
export const ACHIEVEMENTS = {
  firstBlood: { kind: 'totalKills', goal: 1000, credits: 100, shards: 1 },
  exterminator: { kind: 'totalKills', goal: 25000, credits: 500, shards: 5 },
  bossHunter: { kind: 'bossesTotal', goal: 10, credits: 300, shards: 3 },
  survivor: { kind: 'win', goal: 1, credits: 500, shards: 5 },
  collector: { kind: 'collection', goal: 5, credits: 400, shards: 0 },
  veteran: { kind: 'survivorLevel', goal: 10, credits: 300, shards: 3 },
  glowing: { kind: 'irradiated', goal: 1, credits: 200, shards: 0 },
} as const satisfies Record<string, AchievementDef>;
export type AchievementId = keyof typeof ACHIEVEMENTS;
export const ACHIEVEMENT_IDS = Object.keys(ACHIEVEMENTS) as AchievementId[];

export const SAVE = {
  key: 'atomicash-save',
  version: 2,
  /** Créditos de una cuenta nueva. */
  startCredits: 0,
} as const;
