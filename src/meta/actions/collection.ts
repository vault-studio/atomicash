// Colección de supervivientes: conseguir, estrellas, experiencia, activo y personaje inicial.
import { STARS, SURVIVOR_LEVEL } from '../../config/meta';
import { ROSTER, SURVIVORS, type StatSurvivorId, type SurvivorRarity } from '../../config/survivors';
import { newSurvivor, type OwnedSurvivor, type SaveData } from '../save';

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
