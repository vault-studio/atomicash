// Modelo de guardado y valores por defecto.
import { type ConsumableId } from '../../config/items';
import {
  BACKPACK,
  SAVE,
  UPGRADE_IDS,
  ZONE_IDS,
  type AchievementId,
  type ImplantId,
  type MissionId,
  type UpgradeId,
  type ZoneId,
} from '../../config/meta';
import { type StatSurvivorId } from '../../config/survivors';
import { type TreeNodeId } from '../../config/tree';
import { type WeaponId } from '../../config/weapons';

export type Language = 'es' | 'en';

export interface Settings {
  musicVol: number;
  sfxVol: number;
  crtFilter: boolean;
  damageNumbers: boolean;
  language: Language;
  reduceMotion: boolean;
}

export interface OwnedSurvivor {
  level: number;
  xp: number;
  stars: number;
  shards: number;
  irradiated: boolean;
  upgrades: Record<UpgradeId, number>;
  implant: ImplantId | null;
  learnedStarters: WeaponId[];
  /** Arma inicial elegida (null = la suya). */
  starter: WeaponId | null;
  /** Su árbol: nodos aprendidos (sin el centro), en orden desde el centro. Cada uno cuesta un punto. */
  tree: TreeNodeId[];
}

export interface MissionProgress {
  id: MissionId;
  progress: number;
  claimed: boolean;
  /** Superviviente de las misiones «sobrevive con X». */
  char: StatSurvivorId | null;
}

export interface SaveData {
  version: number;
  profile: {
    nickname: string | null;
    credits: number;
    starterChosen: StatSurvivorId | null;
    active: StatSurvivorId | null;
    stats: { runs: number; kills: number; bestTimeSec: number; bossesKilled: number; wins: number };
  };
  survivors: Partial<Record<StatSurvivorId, OwnedSurvivor>>;
  inventory: { consumables: Record<ConsumableId, number> };
  gacha: { pity: Record<ZoneId, number>; pulls: number };
  missions: { day: string; daily: MissionProgress[]; achievements: Partial<Record<AchievementId, boolean>> };
  /** Reto diario: día UTC del último intento, mejor marca de ese día y si ya se cobró el premio. */
  daily: { day: string; best: { dmg: number; time: number; kills: number } | null; rewarded: boolean };
  settings: Settings;
}

export function defaultLanguage(): Language {
  const nav = typeof navigator === 'undefined' ? 'es' : navigator.language.toLowerCase();
  return nav.startsWith('es') ? 'es' : 'en';
}

export function defaultSettings(): Settings {
  return {
    musicVol: 0.5,
    sfxVol: 0.7,
    crtFilter: true,
    damageNumbers: true,
    language: defaultLanguage(),
    reduceMotion: typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
}

export function newSurvivor(): OwnedSurvivor {
  return {
    level: 1,
    xp: 0,
    stars: 1,
    shards: 0,
    irradiated: false,
    upgrades: Object.fromEntries(UPGRADE_IDS.map((k) => [k, 0])) as Record<UpgradeId, number>,
    implant: null,
    learnedStarters: [],
    starter: null,
    tree: [],
  };
}

export function defaultSave(): SaveData {
  return {
    version: SAVE.version,
    profile: {
      nickname: null,
      credits: SAVE.startCredits,
      starterChosen: null,
      active: null,
      stats: { runs: 0, kills: 0, bestTimeSec: 0, bossesKilled: 0, wins: 0 },
    },
    survivors: {},
    inventory: { consumables: { ...BACKPACK.start } },
    gacha: { pity: Object.fromEntries(ZONE_IDS.map((z) => [z, 0])) as Record<ZoneId, number>, pulls: 0 },
    missions: { day: '', daily: [], achievements: {} },
    daily: { day: '', best: null, rewarded: false },
    settings: defaultSettings(),
  };
}
