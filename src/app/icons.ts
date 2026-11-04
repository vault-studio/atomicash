// Iconos 128×128 de armas, rasgos y del HUD (`assets/icons/`, recortados con tools/slice_icons.py) y dibujos de los
// objetos del mapa (`assets/pickups/`, tools/slice_pickups.py). Los publica el plugin artAssets.
import type { ConsumableId, ItemId } from '../config/items';
import type { UpgradeId } from '../config/meta';
import type { NodeGain, TreeNode } from '../config/tree';
import type { TraitId } from '../config/traits';
import type { WeaponId } from '../config/weapons';

const BASE = `${import.meta.env.BASE_URL}assets/icons/`;
const PICKUPS = `${import.meta.env.BASE_URL}assets/pickups/`;

export const weaponIcon = (id: WeaponId): string => `${BASE}${id}.png`;
export const traitIcon = (id: TraitId): string => `${BASE}traits/${id}.png`;
/** Consumibles, objetos de jefe y la carta de curación. */
export const hudIcon = (id: ConsumableId | ItemId | 'heal'): string => `${BASE}hud/${id}.png`;
/**
 * Mejoras del Taller. DECISIÓN: provisionales con dibujos de rasgos y del HUD hasta que haya iconos propios; el
 * afilador es el que menos se parece (punta de lanza).
 */
const UPGRADE_ICONS: Readonly<Record<UpgradeId, string>> = {
  hp: 'traits/plate',
  dmg: 'traits/tips',
  spd: 'traits/boots',
  mag: 'traits/magnet',
  reroll: 'hud/dice',
  cons: 'hud/belt',
};
export const upgradeIcon = (id: UpgradeId): string => `${BASE}${UPGRADE_ICONS[id]}.png`;
/** Dibujo con transparencia de un objeto del mapa (sin ficha de chapa detrás). */
export const pickupIcon = (id: 'coupon' | 'bomb' | 'barrel' | 'crate'): string => `${PICKUPS}${id}.png`;

/** Icono de una fuente de daño del resumen; el bombardeo de hinchados no tiene. */
export function sourceIcon(src: string): string | undefined {
  switch (src) {
    case 'hinchado':
      return undefined;
    case 'granada':
      return hudIcon('grenade');
    case 'bomba':
      return pickupIcon('bomb');
    case 'barril':
      return pickupIcon('barrel');
    default:
      return weaponIcon(src as WeaponId);
  }
}

/**
 * Dibujo de cada nodo del Árbol según lo que da (su primer `gain`). PROVISIONALES: se reutilizan los iconos de
 * rasgos, del HUD, de armas y de los objetos del mapa hasta que haya iconos propios.
 */
type Gain = NodeGain;
const TREE_STAT_ICONS: Readonly<Partial<Record<NonNullable<Gain['stat']>, string>>> = {
  dmg: 'traits/tips',
  hp: 'traits/plate',
  crit: 'traits/scope',
  armor: 'traits/helmet',
  mag: 'traits/magnet',
  regen: 'traits/suture',
  spd: 'traits/boots',
  xp: 'traits/manual',
  kb: 'traits/stock',
  area: 'traits/fuse',
  cd: 'traits/oil',
  dodge: 'traits/cat',
  luck: 'traits/rabbit',
  radDecay: 'traits/iodine',
};
const TREE_MOD_ICONS: Readonly<Record<NonNullable<Gain['mod']>, string>> = {
  coupons: 'coupon',
  banish: 'traits/fuse',
  lock: 'cache',
  reroll: 'hud/dice',
  hunter: 'hud/bobble',
  coldBlood: 'traits/cat',
  smuggler: 'chest',
  melee: 'w:martillo_pilon',
  consDur: 'hud/turbo',
  starter: 'w:pistola_clavos',
  radRes: 'hud/iodine',
  radPen: 'hud/apron',
  radSave: 'traits/iodine',
  radBoost: 'nuka',
  radHighDmg: 'traits/adren',
  radHighCd: 'traits/oil',
  radHighRegen: 'traits/suture',
  meleeStun: 'traits/stock',
  meleeHeal: 'hud/heal',
  fusionDmg: 'w:remachadora',
  burnDmg: 'w:coctel',
  stimHeal: 'hud/stim',
  consExtra: 'hud/belt',
  consSave: 'hud/fridge',
  moveDmg: 'hud/skates',
  dodgeRush: 'traits/rabbit',
  levelHeal: 'hud/heal',
};
/**
 * Icono de un nodo del Árbol (por su primer `gain`); el centro (sin efecto) es la baliza del refugio. Los de arma
 * inicial llevan el icono de `starter` (el arma inicial del personaje) si se da.
 */
export function treeIcon(n: Pick<TreeNode, 'gains'>, starter?: WeaponId): string {
  const g = n.gains[0];
  if (g?.mod === 'starter' && starter) return weaponIcon(starter);
  const key = (g?.stat ? TREE_STAT_ICONS[g.stat] : g?.mod ? TREE_MOD_ICONS[g.mod] : null) ?? 'beacon';
  if (key.startsWith('w:')) return weaponIcon(key.slice(2) as WeaponId);
  return key.includes('/') ? `${BASE}${key}.png` : `${PICKUPS}${key}.png`;
}
