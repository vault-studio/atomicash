// Iconos 128×128 de armas, rasgos y del HUD (`assets/icons/`, recortados con tools/slice_icons.py) y dibujos de los
// objetos del mapa (`assets/pickups/`, tools/slice_pickups.py). Los publica el plugin artAssets.
import type { ConsumableId, ItemId } from '../config/items';
import type { UpgradeId } from '../config/meta';
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
