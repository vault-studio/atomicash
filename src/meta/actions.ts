// Reglas del Búnker (02_GAMEPLAY.md §8–9). Todas mutan un borrador de `SaveData`: el store lo clona antes.
import { CONSUMABLE_IDS, type ConsumableId } from '../config/items';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_IDS,
  BACKPACK,
  DAILY_COUNT,
  GACHA,
  IMPLANTS,
  IMPLANT_IDS,
  IRRADIATED_PULL,
  MERCHANT,
  MISSIONS,
  MISSION_IDS,
  RARITIES,
  STARTERS,
  type StarterId,
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
  TREE,
  TREE_ROOT,
  nodeCost,
  treeNeighbors,
  type TreeMod,
  type TreeNode,
  type TreeNodeId,
} from '../config/tree';
import type { WeaponId } from '../config/weapons';
import { createRng, type Rng } from '../engine/rng';
import type { RunResults, WorldOptions } from '../engine/world';
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

/** Resultado del test: el inicial con más respuestas; en empate, el primero de `STARTERS`. */
export function psychResult(answers: readonly number[]): StarterId {
  const score = STARTERS.map((_, i) => answers.filter((a) => a === i).length);
  let best = 0;
  for (let i = 1; i < score.length; i++) if (score[i]! > score[best]!) best = i;
  return STARTERS[best]!;
}

/**
 * Perfil psicológico: el elegido pasa a ser el activo. Solo la primera vez.
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
  for (const n of s.tree.nodes) {
    const def: TreeNode = TREE[n];
    if (def.stat) add(def.stat, def.v);
    if (def.mod) mods[def.mod] = (mods[def.mod] ?? 0) + def.v;
  }
  for (const k of Object.keys(bonus) as StatKey[]) if (bonus[k] === 0) delete bonus[k];
  return {
    bonus,
    mods,
    extraRerolls: o.upgrades.reroll * UPGRADES.reroll.per + (mods.reroll ?? 0),
    consumables: backpackFor(s, o),
    ...(o.starter && o.starter !== SURVIVORS[id].weapon ? { startWeapon: o.starter } : {}),
  };
}

/** Consumibles que se lleva a la run: hasta `perRun` (+ taller) de cada uno, si los tiene. */
function backpackFor(s: SaveData, o: OwnedSurvivor): Record<ConsumableId, number> {
  const cap = BACKPACK.perRun + o.upgrades.cons * UPGRADES.cons.per;
  return Object.fromEntries(
    CONSUMABLE_IDS.map((c) => [c, Math.min(cap, s.inventory.consumables[c])]),
  ) as Record<ConsumableId, number>;
}

// ---------- árbol de pasivas ----------

/** Se puede comprar si no lo tiene y toca el centro o un nodo comprado. */
export function canAllocate(s: SaveData, id: TreeNodeId): boolean {
  if (id === TREE_ROOT || s.tree.nodes.includes(id)) return false;
  return treeNeighbors(id).some((n) => n === TREE_ROOT || s.tree.nodes.includes(n));
}

export const treeCost = (s: SaveData, id: TreeNodeId): number => nodeCost(id, s.tree.nodes.length);

export function allocateNode(s: SaveData, id: TreeNodeId): boolean {
  if (!canAllocate(s, id)) return false;
  const cost = treeCost(s, id);
  if (!spend(s, cost)) return false;
  s.tree.nodes.push(id);
  s.tree.spent += cost;
  return true;
}

/** Desaprende todo el árbol y devuelve los cupones gastados. */
export function resetTree(s: SaveData): number {
  const back = s.tree.spent;
  s.profile.credits += back;
  s.tree = { nodes: [], spent: 0 };
  return back;
}

// ---------- recompensas de la run ----------

export interface RunReward {
  credits: number;
  xp: number;
  levelUps: number;
  achievements: AchievementId[];
}

/** Cierra una run: créditos, XP del superviviente, estadísticas, consumibles sobrantes, misiones y logros. */
export function applyRun(s: SaveData, r: RunResults, now: Date): RunReward {
  refreshDaily(s, now);
  s.profile.credits += r.credits;
  const st = s.profile.stats;
  st.runs++;
  st.kills += r.kills;
  st.bossesKilled += r.bosses;
  st.bestTimeSec = Math.max(st.bestTimeSec, Math.floor(r.time));
  if (r.won) st.wins++;
  // La Mochila se descuenta al cerrar la run (así abandonar o recargar no pierde nada).
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
  return { credits: r.credits, xp, levelUps, achievements: checkAchievements(s) };
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

// ---------- mercader ----------

export type Offer =
  | { key: string; kind: 'consumable'; id: ConsumableId; qty: number; price: number }
  | { key: string; kind: 'implant'; id: ImplantId; price: number }
  | { key: string; kind: 'manual'; char: StatSurvivorId; weapon: WeaponId; price: number };

/** Inventario del día: mismo para todo el día local, cambia a medianoche. */
export function merchantStock(s: SaveData, now: Date): Offer[] {
  const day = dayKey(now);
  const rng = createRng(hashSeed('merchant:' + day));
  const offers: Offer[] = [];
  for (const id of pickN(rng, CONSUMABLE_IDS, MERCHANT.consumables))
    offers.push({
      key: `c:${id}`,
      kind: 'consumable',
      id,
      qty: MERCHANT.consumablePack,
      price: MERCHANT.consumablePrice[id] * MERCHANT.consumablePack,
    });
  for (const id of pickN(rng, IMPLANT_IDS, MERCHANT.implants))
    offers.push({ key: `i:${id}`, kind: 'implant', id, price: IMPLANTS[id].price });
  // Los manuales se eligen entre los supervivientes que tienes, con armas que aún no saben.
  const pairs: { char: StatSurvivorId; weapon: WeaponId }[] = [];
  for (const char of owned(s))
    for (const weapon of MERCHANT.manualWeapons)
      if (weapon !== SURVIVORS[char].weapon) pairs.push({ char, weapon });
  for (const p of pickN(rng, pairs, MERCHANT.manuals))
    offers.push({ key: `m:${p.char}:${p.weapon}`, kind: 'manual', ...p, price: MERCHANT.manualPrice });
  return offers;
}

function refreshShop(s: SaveData, now: Date): void {
  const day = dayKey(now);
  if (s.shop.day !== day) {
    s.shop.day = day;
    s.shop.bought = [];
  }
}

export function isSoldOut(s: SaveData, o: Offer, now: Date): boolean {
  if (s.shop.day !== dayKey(now)) return false;
  if (s.shop.bought.includes(o.key)) return o.kind !== 'consumable';
  if (o.kind === 'manual') return s.survivors[o.char]?.learnedStarters.includes(o.weapon) ?? true;
  return false;
}

/** Compra una oferta. Los implantes van al superviviente activo y sustituyen al que tuviera. */
export function buyOffer(s: SaveData, key: string, now: Date): boolean {
  refreshShop(s, now);
  const o = merchantStock(s, now).find((x) => x.key === key);
  if (!o || isSoldOut(s, o, now)) return false;
  const target =
    o.kind === 'manual' ? s.survivors[o.char] : s.profile.active ? s.survivors[s.profile.active] : undefined;
  if (o.kind !== 'consumable' && !target) return false;
  if (!spend(s, o.price)) return false;
  s.shop.bought.push(o.key);
  if (o.kind === 'consumable') s.inventory.consumables[o.id] += o.qty;
  else if (o.kind === 'implant') target!.implant = o.id;
  else target!.learnedStarters.push(o.weapon);
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
