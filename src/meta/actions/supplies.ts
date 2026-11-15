// Cajas de suministros: rareza y personaje que sale.
import { GACHA, IRRADIATED_PULL, RARITIES, topRarity, type PullSize, type ZoneId } from '../../config/meta';
import { SURVIVORS, type StatSurvivorId, type SurvivorRarity } from '../../config/survivors';
import { type Rng } from '../../engine/rng';
import { type SaveData } from '../save';
import { type Grant, grantSurvivor } from './collection';
import { checkAchievements } from './missions';
import { spend } from './util';

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
