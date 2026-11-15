// Taller e intendencia: mejoras, implantes, armas iniciales, consumibles y opciones de la run.
import { CONSUMABLE_IDS, type ConsumableId } from '../../config/items';
import {
  BACKPACK,
  IMPLANTS,
  MERCHANT,
  STARS,
  SURVIVOR_LEVEL,
  UPGRADES,
  upgradeCost,
  type ImplantId,
  type UpgradeId,
} from '../../config/meta';
import { SURVIVORS, type StatSurvivorId } from '../../config/survivors';
import type { StatKey } from '../../config/traits';
import { treeOf, type TreeMod } from '../../config/tree';
import type { WeaponId } from '../../config/weapons';
import type { WorldOptions } from '../../engine/world';
import { newSurvivor, type OwnedSurvivor, type SaveData } from '../save';
import { spend } from './util';

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
