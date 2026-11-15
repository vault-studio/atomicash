// Botín en el suelo: recogibles, cofres, cupones y bolitas de experiencia.
import { FIELD_PICKUP_IDS, FIELD_PICKUPS, type FieldPickupId } from '../../../config/items';
import { chestSpot } from '../../obstacles';
import { XP } from '../../../config/run';
import { type Pickup, type PickupKind, type World } from '../../types';

export const createPickup = (): Pickup => ({ kind: 'gem', val: 0, x: 0, y: 0, r: 0, pull: false, sp: 0 });

export function addPickup(
  w: World,
  kind: PickupKind,
  x: number,
  y: number,
  r: number,
  val = 0,
  pull = false,
): Pickup {
  const k = w.pickups.acquire();
  k.kind = kind;
  k.val = val;
  k.x = x;
  k.y = y;
  k.r = r;
  k.pull = pull;
  k.sp = 0;
  if (kind === 'gem') w.gemCount++;
  return k;
}

const chest = { x: 0, y: 0 };

/** Cofre, cofre especial o caja: como `addPickup`, pero siempre en un sitio donde se vea. */
export function addChest(w: World, kind: PickupKind, x: number, y: number, r: number): Pickup {
  chestSpot(w, x, y, chest);
  return addPickup(w, kind, chest.x, chest.y, r);
}

/** Suma cupones de la partida con el extra del árbol. Devuelve los sumados. */
export function addCoupons(w: World, n: number): number {
  const v = Math.round(n * (1 + (w.mods.coupons ?? 0) / 100));
  w.coupons += v;
  return v;
}

/** Suelta chatarra por valor `value`, en las piezas más grandes posibles. */
export function dropGems(w: World, x: number, y: number, value: number): void {
  let v = Math.round(value);
  for (const g of XP.gems) {
    while (v >= g) {
      v -= g;
      if (w.gemCount >= XP.maxGems && mergeIntoGem(w, g)) continue;
      addPickup(w, 'gem', x + (w.rng() - 0.5) * 18, y + (w.rng() - 0.5) * 18, XP.gemRadius[g] ?? 3.5, g);
    }
  }
}

/** Reparte `value` de experiencia en `count` bolitas (el resto entero, en las primeras). */
export function dropKillGems(w: World, x: number, y: number, value: number, count: number): void {
  const v = Math.max(count, Math.round(value));
  const each = Math.floor(v / count);
  for (let i = 0; i < count; i++) {
    const g = each + (i < v % count ? 1 : 0);
    if (w.gemCount >= XP.maxGems && mergeIntoGem(w, g)) continue;
    const spread = count > 1 ? 18 : 0;
    addPickup(w, 'gem', x + (w.rng() - 0.5) * spread, y + (w.rng() - 0.5) * spread, gemRadius(g), g);
  }
}

/** Tamaño de la bolita según lo que vale. */
function gemRadius(v: number): number {
  for (const g of XP.gems) if (v >= g) return XP.gemRadius[g] ?? 3.5;
  return XP.gemRadius[1] ?? 3.5;
}

/** Con demasiadas gemas en el suelo, suma el valor a una existente al azar. */
function mergeIntoGem(w: World, g: number): boolean {
  const n = w.pickups.count;
  if (n === 0) return false;
  const start = (w.rng() * n) | 0;
  for (let j = 0; j < n; j++) {
    const k = w.pickups.items[(start + j) % n]!;
    if (k.kind === 'gem') {
      k.val += g;
      return true;
    }
  }
  return false;
}

/** Elige botiquín, imán o bomba según sus pesos; `u` ∈ [0, 1). */
export function rollFieldPickup(u: number): FieldPickupId {
  const W = FIELD_PICKUPS.weights;
  let total = 0;
  for (const id of FIELD_PICKUP_IDS) total += W[id];
  let r = u * total;
  for (const id of FIELD_PICKUP_IDS) {
    if (r < W[id]) return id;
    r -= W[id];
  }
  return FIELD_PICKUP_IDS[FIELD_PICKUP_IDS.length - 1]!;
}
