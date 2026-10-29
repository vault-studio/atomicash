// Modelo de guardado (05_TECH.md §4), valores por defecto, migraciones y exportar/importar.
// TS puro: el store de Zustand solo envuelve estas funciones.
import { CONSUMABLE_IDS, type ConsumableId } from '../config/items';
import {
  ACHIEVEMENT_IDS,
  BACKPACK,
  MISSION_IDS,
  SAVE,
  UPGRADE_IDS,
  ZONE_IDS,
  IMPLANT_IDS,
  type AchievementId,
  type ImplantId,
  type MissionId,
  type UpgradeId,
  type ZoneId,
} from '../config/meta';
import { ROSTER, type StatSurvivorId } from '../config/survivors';
import { WEAPON_IDS, type WeaponId } from '../config/weapons';

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
  shop: { day: string; bought: string[] };
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
    shop: { day: '', bought: [] },
    settings: defaultSettings(),
  };
}

// ---------- normalización (migraciones e importación) ----------

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, d: number, min = -Infinity, max = Infinity): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);
const str = (v: unknown, d: string): string => (typeof v === 'string' ? v : d);
const oneOf = <T extends string>(v: unknown, list: readonly T[], d: T): T =>
  typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : d;
const oneOfOrNull = <T extends string>(v: unknown, list: readonly T[]): T | null =>
  typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : null;

function normSurvivor(raw: unknown): OwnedSurvivor {
  const d = newSurvivor();
  if (!isObj(raw)) return d;
  const up = isObj(raw.upgrades) ? raw.upgrades : {};
  return {
    level: num(raw.level, 1, 1, 30),
    xp: num(raw.xp, 0, 0),
    stars: num(raw.stars, 1, 1, 5),
    shards: num(raw.shards, 0, 0),
    irradiated: bool(raw.irradiated, false),
    upgrades: Object.fromEntries(UPGRADE_IDS.map((k) => [k, num(up[k], 0, 0, 10)])) as Record<
      UpgradeId,
      number
    >,
    // v0 guardaba una lista `implants`; se queda el primero.
    implant: oneOfOrNull(raw.implant ?? (Array.isArray(raw.implants) ? raw.implants[0] : null), IMPLANT_IDS),
    learnedStarters: Array.isArray(raw.learnedStarters)
      ? raw.learnedStarters.filter((w): w is WeaponId => (WEAPON_IDS as string[]).includes(w as string))
      : [],
    starter: oneOfOrNull(raw.starter, WEAPON_IDS),
  };
}

/**
 * Convierte cualquier dato guardado (de una versión anterior, importado o corrupto) en un `SaveData`
 * válido de la versión actual. Lo desconocido se descarta y lo que falta toma el valor por defecto.
 */
export function normalize(raw: unknown): SaveData {
  const d = defaultSave();
  if (!isObj(raw)) return d;
  const p = isObj(raw.profile) ? raw.profile : {};
  const ps = isObj(p.stats) ? p.stats : {};
  const sv = isObj(raw.survivors) ? raw.survivors : {};
  const inv = isObj(raw.inventory) && isObj(raw.inventory.consumables) ? raw.inventory.consumables : null;
  const g = isObj(raw.gacha) ? raw.gacha : {};
  const pity = isObj(g.pity) ? g.pity : isObj(g.pityCounter) ? g.pityCounter : {};
  const m = isObj(raw.missions) ? raw.missions : {};
  const ach = isObj(m.achievements) ? m.achievements : {};
  const sh = isObj(raw.shop) ? raw.shop : {};
  const st = isObj(raw.settings) ? raw.settings : {};
  const survivors: SaveData['survivors'] = {};
  // Los supervivientes que ya no están en el plantel se quitan; si era el inicial, se repite el test.
  for (const id of ROSTER) if (sv[id] !== undefined) survivors[id] = normSurvivor(sv[id]);
  const starterChosen = oneOfOrNull(p.starterChosen, ROSTER);
  // Tras el test se juega con cualquiera del plantel: los que falten entran a nivel 1.
  if (starterChosen) for (const id of ROSTER) survivors[id] ??= newSurvivor();
  const active = oneOfOrNull(p.active, ROSTER) ?? starterChosen;
  return {
    version: SAVE.version,
    profile: {
      nickname: typeof p.nickname === 'string' ? p.nickname.slice(0, 20) : null,
      credits: Math.floor(num(p.credits, d.profile.credits, 0)),
      starterChosen,
      active: active && survivors[active] ? active : null,
      stats: {
        runs: num(ps.runs, 0, 0),
        kills: num(ps.kills, 0, 0),
        bestTimeSec: num(ps.bestTimeSec, 0, 0),
        bossesKilled: num(ps.bossesKilled, 0, 0),
        wins: num(ps.wins, 0, 0),
      },
    },
    survivors,
    inventory: {
      consumables: inv
        ? (Object.fromEntries(CONSUMABLE_IDS.map((c) => [c, Math.floor(num(inv[c], 0, 0, 999))])) as Record<
            ConsumableId,
            number
          >)
        : d.inventory.consumables,
    },
    gacha: {
      pity: Object.fromEntries(ZONE_IDS.map((z) => [z, Math.floor(num(pity[z], 0, 0, 1000))])) as Record<
        ZoneId,
        number
      >,
      pulls: num(g.pulls, 0, 0),
    },
    missions: {
      day: str(m.day, ''),
      daily: Array.isArray(m.daily)
        ? m.daily.filter(isObj).flatMap((x) => {
            const id = oneOfOrNull(x.id, MISSION_IDS);
            return id
              ? [
                  {
                    id,
                    progress: num(x.progress, 0, 0),
                    claimed: bool(x.claimed, false),
                    char: oneOfOrNull(x.char, ROSTER),
                  },
                ]
              : [];
          })
        : [],
      achievements: Object.fromEntries(
        ACHIEVEMENT_IDS.filter((a) => ach[a] === true).map((a) => [a, true]),
      ) as SaveData['missions']['achievements'],
    },
    shop: {
      day: str(sh.day, ''),
      bought: Array.isArray(sh.bought) ? sh.bought.filter((x): x is string => typeof x === 'string') : [],
    },
    settings: {
      musicVol: num(st.musicVol, d.settings.musicVol, 0, 1),
      sfxVol: num(st.sfxVol, d.settings.sfxVol, 0, 1),
      crtFilter: bool(st.crtFilter, d.settings.crtFilter),
      damageNumbers: bool(st.damageNumbers, d.settings.damageNumbers),
      language: oneOf(st.language, ['es', 'en'] as const, d.settings.language),
      reduceMotion: bool(st.reduceMotion, d.settings.reduceMotion),
    },
  };
}

/** Migración del store persistido: de cualquier versión anterior a la actual. */
export function migrate(persisted: unknown, fromVersion: number): SaveData {
  // v0 (prototipo) → v1: mismos campos con otros nombres; `normalize` los recoge.
  const s = normalize(persisted);
  // v1 → v2: los números de daño pasan a estar activados por defecto.
  if (fromVersion < 2) s.settings.damageNumbers = true;
  return s;
}

const EXPORT_TAG = 'atomicash-save';

export function exportSave(s: SaveData): string {
  return JSON.stringify({ app: EXPORT_TAG, version: s.version, data: s });
}

/** Lee un JSON exportado. Devuelve null si no es una partida de Atomic Ash. */
export function importSave(json: string): SaveData | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isObj(raw) || raw.app !== EXPORT_TAG || !isObj(raw.data)) return null;
  return migrate(raw.data, num(raw.version, 0));
}
