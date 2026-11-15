// Qué tarjetas se ofrecen: mejoras y armas nuevas, apaños, rasgos y rareza.
import { PLAYER } from '../../../config/run';
import { CARDS, TRAITS, TRAIT_IDS, type TraitDef, type TraitId } from '../../../config/traits';
import { weaponSlots } from '../../../config/survivors';
import { FUSIONS, WEAPONS, WEAPON_IDS, type WeaponId } from '../../../config/weapons';
import type { Card, World } from '../../types';

// ---------- tarjetas ----------

function wpick(w: World, weights: readonly number[]): number {
  let sum = 0;
  for (const x of weights) sum += x;
  let r = w.rng() * sum;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]!;
    if (r < 0) return i;
  }
  return weights.length - 1;
}

const isFusion = (id: WeaponId): boolean => (WEAPONS[id] as { fusion?: boolean }).fusion === true;
const ownerOf = (id: WeaponId): string | undefined => (WEAPONS[id] as { owner?: string }).owner;

/** Mejoras de armas que ya tiene y armas nuevas que caben. */
export function weaponOptions(w: World): Card[] {
  const opts: Card[] = [];
  const owned = new Set(w.weapons.map((x) => x.id));
  const blocked = new Set<WeaponId>();
  for (const f of FUSIONS)
    if (owned.has(f.result)) {
      blocked.add(f.a);
      blocked.add(f.b);
    }
  for (const wp of w.weapons)
    if (!isFusion(wp.id) && wp.lvl < PLAYER.maxWeaponLevel && !w.banished.has(`w:${wp.id}`))
      opts.push({ kind: 'up', id: wp.id });
  if (w.weapons.length < weaponSlots(w.charId, PLAYER.weaponSlots))
    for (const id of WEAPON_IDS) {
      if (isFusion(id) || owned.has(id) || blocked.has(id) || w.banished.has(`w:${id}`)) continue;
      const owner = ownerOf(id);
      if (owner && owner !== w.charId) continue;
      opts.push({ kind: 'new', id });
    }
  return opts;
}

/** Apaños disponibles: las dos armas de la receta al nivel máximo. */
export function fusionOptions(w: World): Card[] {
  const out: Card[] = [];
  for (const f of FUSIONS) {
    const a = w.weapons.find((x) => x.id === f.a);
    const b = w.weapons.find((x) => x.id === f.b);
    if (a && b && a.lvl >= PLAYER.maxWeaponLevel && b.lvl >= PLAYER.maxWeaponLevel)
      out.push({ kind: 'fusion', id: f.result });
  }
  return out;
}

/** Rasgo elegido en las últimas N subidas seguidas (no se ofrece otra vez). */
function streakBlocked(w: World): TraitId | null {
  const N = CARDS.traitStreakBlock;
  const h = w.levelHistory;
  if (N <= 0 || h.length < N) return null;
  const id = h[h.length - 1];
  if (!id) return null;
  for (let i = h.length - N; i < h.length; i++) if (h[i] !== id) return null;
  return id;
}

export function traitOptions(w: World): TraitId[] {
  const blocked = streakBlocked(w);
  return TRAIT_IDS.filter(
    (id) => id !== blocked && w.tr[TRAITS[id].stat] < TRAITS[id].max && !w.banished.has(`t:${id}`),
  );
}

/** Lo que identifica a una tarjeta para desterrarla o no repetirla: el arma (mejora o nueva) o el rasgo. */
export function cardKey(c: Card): string {
  if (c.kind === 'up' || c.kind === 'new' || c.kind === 'fusion') return `w:${c.id}`;
  if (c.kind === 'trait') return `t:${c.id}`;
  return c.kind;
}

/** ¿La tarjeta bloqueada sigue valiendo (el arma no está al máximo, el rasgo no tiene tope…)? */
export function stillValid(w: World, c: Card): boolean {
  const k = cardKey(c);
  if (c.kind === 'trait') return traitOptions(w).some((id) => `t:${id}` === k);
  if (c.kind === 'up' || c.kind === 'new')
    return weaponOptions(w).some((o) => o.kind === c.kind && cardKey(o) === k);
  if (c.kind === 'fusion') return fusionOptions(w).some((o) => cardKey(o) === k);
  return false;
}

function rollRarity(w: World): 'common' | 'rare' | 'epic' {
  const r = w.rng() * Math.max(CARDS.minRoll, 100 - w.st.luck);
  return r < CARDS.epic ? 'epic' : r < CARDS.rare ? 'rare' : 'common';
}

function makeTraitCard(w: World, id: TraitId): Card {
  const T: (typeof TRAITS)[TraitId] = TRAITS[id];
  const rarity = rollRarity(w);
  const intVals = 'intVals' in T ? T.intVals : CARDS.intVals;
  let value = 'int' in T && T.int ? intVals[rarity] : Math.round(T.base * CARDS.rarityMult[rarity] * 10) / 10;
  value = Math.min(value, T.max - w.tr[T.stat]);
  return { kind: 'trait', id, rarity, value };
}

/** Tarjetas de subida de nivel; `keep` va primero y no se repite. */
export function rollLevelCards(w: World, keep: Card | null): Card[] {
  const cards: Card[] = keep ? [keep] : [];
  const used = new Set(cards.map(cardKey));
  const fus = fusionOptions(w).filter((c) => !used.has(cardKey(c)));
  if (fus.length && cards.length < CARDS.count) cards.push(fus[(w.rng() * fus.length) | 0]!);
  for (const c of cards) used.add(cardKey(c));
  const wpool = weaponOptions(w).filter((c) => !used.has(cardKey(c)));
  const tpool = traitOptions(w).filter((id) => !used.has(`t:${id}`));
  while (cards.length < CARDS.count && (wpool.length || tpool.length)) {
    const useW = wpool.length > 0 && (tpool.length === 0 || w.rng() < CARDS.weaponChance);
    if (useW) {
      const i = wpick(
        w,
        wpool.map((o) => (o.kind === 'up' ? CARDS.upWeight : CARDS.newWeight)),
      );
      cards.push(wpool.splice(i, 1)[0]!);
    } else {
      const i = wpick(
        w,
        tpool.map(
          (id) =>
            ((TRAITS[id] as TraitDef).weight ?? CARDS.traitBaseWeight) +
            CARDS.traitPickBonus * (w.traitPicks[id] ?? 0),
        ),
      );
      cards.push(makeTraitCard(w, tpool.splice(i, 1)[0]!));
    }
  }
  return cards;
}
