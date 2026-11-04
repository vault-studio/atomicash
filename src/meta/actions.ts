// Reglas del Búnker (02_GAMEPLAY.md §8–9). Todas mutan un borrador de `SaveData`: el store lo clona antes.
import { CONSUMABLE_IDS, type ConsumableId } from '../config/items';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_IDS,
  BACKPACK,
  DAILY_COUNT,
  GACHA,
  IMPLANTS,
  IRRADIATED_PULL,
  MERCHANT,
  MISSIONS,
  MISSION_IDS,
  RARITIES,
  STARS,
  SURVIVOR_LEVEL,
  topRarity,
  UPGRADES,
  upgradeCost,
  type AchievementId,
  type ImplantId,
  type PullSize,
  type UpgradeId,
  type ZoneId,
} from '../config/meta';
import {
  ROSTER,
  STAT_SURVIVOR_IDS,
  SURVIVORS,
  type StatSurvivorId,
  type SurvivorRarity,
} from '../config/survivors';
import type { StatKey } from '../config/traits';
import {
  TREE_ROOT,
  treeNeighbors,
  treeOf,
  treePointsFor,
  type TreeMod,
  type TreeNodeId,
} from '../config/tree';
import type { WeaponId } from '../config/weapons';
import { createRng, type Rng } from '../engine/rng';
import type { RunResults, WorldOptions } from '../engine/world';
import { DAILY } from '../config/modes';
import { newSurvivor, type OwnedSurvivor, type SaveData } from './save';

// ---------- utilidades ----------

/** Día local `AAAA-MM-DD`: las misiones y el mercader cambian a medianoche local. */
export function dayKey(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** FNV-1a de 32 bits: semilla estable a partir de un texto. */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h | 0;
}

function pickN<T>(rng: Rng, list: readonly T[], n: number): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a.slice(0, n);
}

const owned = (s: SaveData): StatSurvivorId[] => STAT_SURVIVOR_IDS.filter((id) => s.survivors[id]);

function spend(s: SaveData, cost: number): boolean {
  if (s.profile.credits < cost) return false;
  s.profile.credits -= cost;
  return true;
}

// ---------- colección ----------

export interface Grant {
  id: StatSurvivorId;
  rarity: SurvivorRarity;
  isNew: boolean;
  irradiated: boolean;
  shards: number;
}

/** Da un superviviente: nuevo, o fichas si ya estaba. Un irradiado repetido hace irradiado al que tienes. */
export function grantSurvivor(s: SaveData, id: StatSurvivorId, irradiated = false): Grant {
  const rarity = SURVIVORS[id].rarity;
  const cur = s.survivors[id];
  if (!cur) {
    s.survivors[id] = { ...newSurvivor(), irradiated };
    if (!s.profile.active) s.profile.active = id;
    return { id, rarity, isNew: true, irradiated, shards: 0 };
  }
  const shards = STARS.shardsPerDup[rarity];
  cur.shards += shards;
  if (irradiated) cur.irradiated = true;
  return { id, rarity, isNew: false, irradiated, shards };
}

export const starCost = (o: OwnedSurvivor): number | null =>
  o.stars >= STARS.max ? null : (STARS.cost[o.stars - 1] ?? null);

export function starUp(s: SaveData, id: StatSurvivorId): boolean {
  const o = s.survivors[id];
  const cost = o ? starCost(o) : null;
  if (!o || cost === null || o.shards < cost) return false;
  o.shards -= cost;
  o.stars++;
  return true;
}

export function addSurvivorXp(o: OwnedSurvivor, xp: number): number {
  let ups = 0;
  o.xp += xp;
  while (o.level < SURVIVOR_LEVEL.max && o.xp >= SURVIVOR_LEVEL.next(o.level)) {
    o.xp -= SURVIVOR_LEVEL.next(o.level);
    o.level++;
    ups++;
  }
  if (o.level >= SURVIVOR_LEVEL.max) o.xp = 0;
  return ups;
}

export function setActive(s: SaveData, id: StatSurvivorId): void {
  if (s.survivors[id]) s.profile.active = id;
}

/**
 * Superviviente inicial: pasa a ser el activo. Solo la primera vez (la app elige el primero de `STARTERS` al crear la
 * partida; ya no hay test).
 * DECISIÓN: todo el plantel queda disponible desde el principio (se elige al salir de expedición); la caja de
 * suministros da estrellas y fichas de los que ya tienes.
 */
export function chooseStarter(s: SaveData, id: StatSurvivorId): void {
  if (s.profile.starterChosen) return;
  s.profile.starterChosen = id;
  grantSurvivor(s, id);
  for (const r of ROSTER) s.survivors[r] ??= newSurvivor();
  s.profile.active = id;
}

// ---------- taller ----------

export function buyUpgrade(s: SaveData, id: StatSurvivorId, up: UpgradeId): boolean {
  const o = s.survivors[id];
  if (!o) return false;
  const lvl = o.upgrades[up];
  if (lvl >= UPGRADES[up].max) return false;
  if (!spend(s, upgradeCost(up, lvl))) return false;
  o.upgrades[up] = lvl + 1;
  return true;
}

/** Opciones de la run para un superviviente: nivel, estrellas, taller, implante, manual y mochila. */
export function runOptionsFor(s: SaveData, id: StatSurvivorId): WorldOptions {
  const o = s.survivors[id] ?? newSurvivor();
  const bonus: Partial<Record<StatKey, number>> = {};
  const add = (k: StatKey, v: number): void => {
    bonus[k] = (bonus[k] ?? 0) + v;
  };
  const star = (o.stars - 1) * STARS.pctPerStar;
  add('hp', Math.round((SURVIVORS[id].hp * star) / 100) + (o.level - 1) * SURVIVOR_LEVEL.hpPerLevel);
  add('dmg', star + (o.level - 1) * SURVIVOR_LEVEL.dmgPerLevel);
  add('spd', star);
  for (const k of Object.keys(UPGRADES) as UpgradeId[]) {
    const def = UPGRADES[k];
    if ('stat' in def && o.upgrades[k] > 0) add(def.stat, def.per * o.upgrades[k]);
  }
  if (o.implant) {
    const im = IMPLANTS[o.implant];
    add(im.up, im.upVal);
    add(im.down, im.downVal);
  }
  const mods: Partial<Record<TreeMod, number>> = {};
  const tree = treeOf(id);
  if (tree)
    for (const n of o.tree)
      for (const g of tree[n].gains) {
        if (g.stat) add(g.stat, g.v);
        if (g.mod) mods[g.mod] = (mods[g.mod] ?? 0) + g.v;
      }
  for (const k of Object.keys(bonus) as StatKey[]) if (bonus[k] === 0) delete bonus[k];
  return {
    bonus,
    mods,
    extraRerolls: o.upgrades.reroll * UPGRADES.reroll.per + (mods.reroll ?? 0),
    consumables: backpackFor(s, o, mods.consExtra ?? 0),
    ...(o.starter && o.starter !== SURVIVORS[id].weapon ? { startWeapon: o.starter } : {}),
  };
}

/** Consumibles que se lleva a la run: hasta `perRun` (+ taller) de cada uno, si los tiene. */
function backpackFor(s: SaveData, o: OwnedSurvivor, extra: number): Record<ConsumableId, number> {
  const cap = BACKPACK.perRun + o.upgrades.cons * UPGRADES.cons.per + extra;
  return Object.fromEntries(
    CONSUMABLE_IDS.map((c) => [c, Math.min(cap, s.inventory.consumables[c])]),
  ) as Record<ConsumableId, number>;
}

// ---------- árbol de cada superviviente ----------

/** Puntos del árbol del personaje (nivel y estrellas). */
export const treePoints = (o: OwnedSurvivor): number => treePointsFor(o.level, o.stars);

/** Puntos sin gastar: los totales menos los nodos aprendidos. */
export const treeFree = (o: OwnedSurvivor): number => treePoints(o) - o.tree.length;

/** Se puede aprender si es de su árbol, no lo tiene, toca el centro o un nodo aprendido y queda un punto libre. */
export function canAllocate(s: SaveData, char: StatSurvivorId, id: TreeNodeId): boolean {
  const o = s.survivors[char];
  if (!o || !treeOf(char) || id === TREE_ROOT || o.tree.includes(id) || treeFree(o) < 1) return false;
  return treeNeighbors(id).some((n) => n === TREE_ROOT || o.tree.includes(n));
}

export function allocateNode(s: SaveData, char: StatSurvivorId, id: TreeNodeId): boolean {
  const o = s.survivors[char];
  if (!o || !canAllocate(s, char, id)) return false;
  o.tree.push(id);
  return true;
}

/** Se puede quitar si está aprendido y lo que queda sigue unido al centro. */
export function canRefund(s: SaveData, char: StatSurvivorId, id: TreeNodeId): boolean {
  const o = s.survivors[char];
  if (!o || !o.tree.includes(id)) return false;
  const rest = o.tree.filter((n) => n !== id);
  const seen = new Set<TreeNodeId>([TREE_ROOT]);
  const queue: TreeNodeId[] = [TREE_ROOT];
  while (queue.length)
    for (const n of treeNeighbors(queue.shift()!))
      if (!seen.has(n) && rest.includes(n)) {
        seen.add(n);
        queue.push(n);
      }
  return rest.every((n) => seen.has(n));
}

/** Recoloca gratis: desaprende un nodo y recupera su punto. */
export function refundNode(s: SaveData, char: StatSurvivorId, id: TreeNodeId): boolean {
  const o = s.survivors[char];
  if (!o || !canRefund(s, char, id)) return false;
  o.tree = o.tree.filter((n) => n !== id);
  return true;
}

/** Desaprende todo su árbol. Devuelve los puntos recuperados. */
export function resetTree(s: SaveData, char: StatSurvivorId): number {
  const o = s.survivors[char];
  if (!o) return 0;
  const back = o.tree.length;
  o.tree = [];
  return back;
}

// ---------- recompensas de la run ----------

export interface RunReward {
  credits: number;
  /** Premio del primer reto diario del día (incluido en `credits`). */
  dailyBonus: number;
  xp: number;
  levelUps: number;
  achievements: AchievementId[];
}

/** Cierra una run: créditos, XP del superviviente, estadísticas, consumibles sobrantes, misiones y logros. */
export function applyRun(s: SaveData, r: RunResults, now: Date): RunReward {
  refreshDaily(s, now);
  s.profile.credits += r.credits;
  const dailyBonus = r.daily ? recordDaily(s, r) : 0;
  const st = s.profile.stats;
  st.runs++;
  st.kills += r.kills;
  st.bossesKilled += r.bosses;
  st.bestTimeSec = Math.max(st.bestTimeSec, Math.floor(r.time));
  if (r.won) st.wins++;
  // La Mochila se descuenta al cerrar la run (así abandonar o recargar no pierde nada). El reto diario no la usa.
  if (!r.daily)
    for (const c of CONSUMABLE_IDS)
      s.inventory.consumables[c] = Math.max(0, s.inventory.consumables[c] - r.consStart[c] + r.consLeft[c]);
  const xp = Math.round(
    r.time * SURVIVOR_LEVEL.perSec + r.kills * SURVIVOR_LEVEL.perKill + r.bosses * SURVIVOR_LEVEL.perBoss,
  );
  const o = s.survivors[r.charId];
  const levelUps = o ? addSurvivorXp(o, xp) : 0;
  const min = Math.floor(r.time / 60);
  for (const m of s.missions.daily) {
    const def = MISSIONS[m.id];
    switch (def.kind) {
      case 'kills':
        m.progress += r.kills;
        break;
      case 'surviveMin':
        m.progress = Math.max(m.progress, min);
        break;
      case 'surviveWith':
        if (m.char === r.charId) m.progress = Math.max(m.progress, min);
        break;
      case 'runs':
        m.progress++;
        break;
      case 'bosses':
        m.progress += r.bosses;
        break;
      case 'consumables':
        m.progress += r.consUsed;
        break;
    }
    m.progress = Math.min(m.progress, def.goal);
  }
  return { credits: r.credits + dailyBonus, dailyBonus, xp, levelUps, achievements: checkAchievements(s) };
}

/** Guarda la marca del reto diario (la mejor del día) y da el premio del primer intento. */
function recordDaily(s: SaveData, r: RunResults): number {
  const d = s.daily;
  if (d.day !== r.daily) {
    d.day = r.daily!;
    d.best = null;
    d.rewarded = false;
  }
  if (!d.best || r.dmg > d.best.dmg) d.best = { dmg: r.dmg, time: Math.floor(r.time), kills: r.kills };
  if (d.rewarded) return 0;
  d.rewarded = true;
  s.profile.credits += DAILY.reward;
  return DAILY.reward;
}

// ---------- misiones y logros ----------

/** Genera las 3 diarias si ha cambiado el día local. */
export function refreshDaily(s: SaveData, now: Date): void {
  const day = dayKey(now);
  if (s.missions.day === day) return;
  const rng = createRng(hashSeed('missions:' + day));
  const chars = owned(s);
  s.missions.day = day;
  s.missions.daily = pickN(rng, MISSION_IDS, DAILY_COUNT).map((id) => ({
    id,
    progress: 0,
    claimed: false,
    char:
      MISSIONS[id].kind === 'surviveWith' ? (pickN(rng, chars.length ? chars : ROSTER, 1)[0] ?? null) : null,
  }));
}

export function claimMission(s: SaveData, i: number): boolean {
  const m = s.missions.daily[i];
  if (!m || m.claimed || m.progress < MISSIONS[m.id].goal) return false;
  m.claimed = true;
  s.profile.credits += MISSIONS[m.id].reward;
  return true;
}

export function achievementProgress(s: SaveData, id: AchievementId): number {
  const def = ACHIEVEMENTS[id];
  const st = s.profile.stats;
  const list = Object.values(s.survivors);
  switch (def.kind) {
    case 'totalKills':
      return st.kills;
    case 'win':
      return st.wins;
    case 'bossesTotal':
      return st.bossesKilled;
    case 'collection':
      return list.length;
    case 'survivorLevel':
      return list.reduce((m, o) => Math.max(m, o.level), 0);
    case 'irradiated':
      return list.filter((o) => o.irradiated).length;
  }
}

/** Desbloquea los logros cumplidos y entrega su premio (créditos y fichas del activo). */
export function checkAchievements(s: SaveData): AchievementId[] {
  const out: AchievementId[] = [];
  for (const id of ACHIEVEMENT_IDS) {
    if (s.missions.achievements[id]) continue;
    const def = ACHIEVEMENTS[id];
    if (achievementProgress(s, id) < def.goal) continue;
    s.missions.achievements[id] = true;
    s.profile.credits += def.credits;
    const act = s.profile.active ? s.survivors[s.profile.active] : undefined;
    if (act) act.shards += def.shards;
    out.push(id);
  }
  return out;
}

// ---------- intendencia y taller del personaje ----------

/** Compra un paquete de un consumible (`MERCHANT.consumablePack` unidades) para la mochila. */
export function buyConsumable(s: SaveData, id: ConsumableId): boolean {
  if (!spend(s, MERCHANT.consumablePrice[id] * MERCHANT.consumablePack)) return false;
  s.inventory.consumables[id] += MERCHANT.consumablePack;
  return true;
}

/** Pone un implante a un superviviente (sustituye al que tuviera). */
export function buyImplant(s: SaveData, char: StatSurvivorId, id: ImplantId): boolean {
  const o = s.survivors[char];
  if (!o || o.implant === id || !spend(s, IMPLANTS[id].price)) return false;
  o.implant = id;
  return true;
}

/** Armas iniciales que un superviviente puede aprender (las de `MERCHANT.manualWeapons` menos la suya). */
export const learnableStarters = (char: StatSurvivorId): WeaponId[] =>
  MERCHANT.manualWeapons.filter((w) => w !== SURVIVORS[char].weapon);

/** Aprende un arma inicial alternativa para un superviviente. */
export function learnStarter(s: SaveData, char: StatSurvivorId, weapon: WeaponId): boolean {
  const o = s.survivors[char];
  if (!o || !learnableStarters(char).includes(weapon) || o.learnedStarters.includes(weapon)) return false;
  if (!spend(s, MERCHANT.manualPrice)) return false;
  o.learnedStarters.push(weapon);
  return true;
}

/** Arma inicial de la próxima run: la suya o una aprendida con un manual. */
export function setStarter(s: SaveData, id: StatSurvivorId, weapon: WeaponId): void {
  const o = s.survivors[id];
  if (!o) return;
  if (weapon === SURVIVORS[id].weapon) o.starter = null;
  else if (o.learnedStarters.includes(weapon)) o.starter = weapon;
}

// ---------- cajas de suministros ----------

/** Rareza de una tirada sin garantías, con las probabilidades públicas de `GACHA.rates`. */
export function rollRarity(rng: Rng): SurvivorRarity {
  let r = rng();
  for (const k of RARITIES) {
    r -= GACHA.rates[k];
    if (r < 0) return k;
  }
  return 'common';
}

/**
 * Abre `size` cajas de una zona. Garantías: legendario tras `GACHA.pity` tiradas seguidas sin él, y cada
 * bloque de 10 de una tirada ×10/×100 trae al menos un raro.
 */
export function pullBoxes(s: SaveData, zone: ZoneId, size: PullSize, rng: Rng): Grant[] | null {
  if (!spend(s, GACHA.cost[size])) return null;
  const out: Grant[] = [];
  let rareInBlock = false;
  // La garantía es de lo mejor que tenga la caja (legendario, si lo hay).
  const top = topRarity(zone);
  for (let i = 0; i < size; i++) {
    if (i % 10 === 0) rareInBlock = false;
    let rarity = rollRarity(rng);
    if (s.gacha.pity[zone] + 1 >= GACHA.pity) rarity = top;
    else if (size >= 10 && i % 10 === 9 && !rareInBlock && rarity === 'common') rarity = 'rare';
    if (rarity !== 'common') rareInBlock = true;
    s.gacha.pity[zone] = RARITIES.indexOf(rarity) >= RARITIES.indexOf(top) ? 0 : s.gacha.pity[zone] + 1;
    s.gacha.pulls++;
    out.push(grantSurvivor(s, pickFromPool(zone, rarity, rng), rng() < IRRADIATED_PULL));
  }
  checkAchievements(s);
  return out;
}

function pickFromPool(zone: ZoneId, rarity: SurvivorRarity, rng: Rng): StatSurvivorId {
  const pool = GACHA.pool[zone] as readonly StatSurvivorId[];
  // Si la caja no tiene esa rareza, baja a la siguiente que haya.
  for (let ri = RARITIES.indexOf(rarity); ri >= 0; ri--) {
    const list = pool.filter((id) => SURVIVORS[id].rarity === RARITIES[ri]);
    if (list.length) return list[Math.floor(rng() * list.length)]!;
  }
  return pool[0]!;
}
