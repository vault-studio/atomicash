// Normalización del guardado: migraciones e importación tolerantes a datos viejos o incompletos.
import { CONSUMABLE_IDS, type ConsumableId } from '../../config/items';
import {
  ACHIEVEMENT_IDS,
  MISSION_IDS,
  SAVE,
  UPGRADE_IDS,
  ZONE_IDS,
  IMPLANT_IDS,
  type UpgradeId,
  type ZoneId,
} from '../../config/meta';
import { ROSTER } from '../../config/survivors';
import { TREE_IDS, TREE_ROOT, treeNeighbors, treePointsFor, type TreeNodeId } from '../../config/tree';
import { WEAPON_IDS, type WeaponId } from '../../config/weapons';
import { type OwnedSurvivor, type SaveData, defaultSave, newSurvivor } from './data';

// ---------- normalización (migraciones e importación) ----------

type Obj = Record<string, unknown>;
export const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
export const num = (v: unknown, d: number, min = -Infinity, max = Infinity): number =>
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
  const level = num(raw.level, 1, 1, 30);
  const stars = num(raw.stars, 1, 1, 5);
  return {
    level,
    xp: num(raw.xp, 0, 0),
    stars,
    // v3 → v4: el árbol viejo se pagaba con chapas; se devuelven (`treeSpent` ya no se vuelve a guardar).
    shards: num(raw.shards, 0, 0) + Math.floor(num(raw.treeSpent, 0, 0)),
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
    // Más nodos que puntos: se quedan los primeros desde el centro (así lo que queda sigue unido).
    tree: connectedNodes(raw.tree).slice(0, treePointsFor(level, stars)),
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
  const st = isObj(raw.settings) ? raw.settings : {};
  const tr = isObj(raw.tree) ? raw.tree : {};
  const dl = isObj(raw.daily) ? raw.daily : {};
  const db = isObj(dl.best) ? dl.best : null;
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
      // v2 → v3: el árbol de cuenta (pagado con cupones) desaparece; se devuelve lo gastado.
      credits: Math.floor(num(p.credits, d.profile.credits, 0)) + Math.floor(num(tr.spent, 0, 0)),
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
    daily: {
      day: str(dl.day, ''),
      best: db ? { dmg: num(db.dmg, 0, 0), time: num(db.time, 0, 0), kills: num(db.kills, 0, 0) } : null,
      rewarded: bool(dl.rewarded, false),
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

/** Nodos válidos del árbol que siguen unidos al centro (lo suelto o desconocido se descarta). */
function connectedNodes(raw: unknown): TreeNodeId[] {
  if (!Array.isArray(raw)) return [];
  const want = new Set(raw.filter((x): x is TreeNodeId => (TREE_IDS as string[]).includes(x as string)));
  const out: TreeNodeId[] = [];
  const queue: TreeNodeId[] = [TREE_ROOT];
  const seen = new Set<TreeNodeId>(queue);
  while (queue.length) {
    for (const n of treeNeighbors(queue.shift()!))
      if (!seen.has(n) && want.has(n)) {
        seen.add(n);
        out.push(n);
        queue.push(n);
      }
  }
  return out;
}

/** Migración del store persistido
: de cualquier versión anterior a la actual. */
export function migrate(persisted: unknown, fromVersion: number): SaveData {
  // v0 (prototipo) → v1: mismos campos con otros nombres; `normalize` los recoge.
  const s = normalize(persisted);
  // v1 → v2: los números de daño pasan a estar activados por defecto.
  if (fromVersion < 2) s.settings.damageNumbers = true;
  return s;
}
