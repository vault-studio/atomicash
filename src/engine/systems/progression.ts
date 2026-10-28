// Recogida de chatarra, XP, subidas de nivel y tarjetas (F1-07), cofres de objeto y consumibles.
import { CONSUMABLES, CONSUMABLE_IDS, FIELD_PICKUPS, ITEM_IDS, type ConsumableId } from '../../config/items';
import { RAD } from '../../config/radiation';
import { COUPONS, FX, PLAYER, XP, xpForLevel } from '../../config/run';
import { CARDS, TRAITS, TRAIT_IDS, type TraitId } from '../../config/traits';
import { survivorStats, weaponSlots, type SurvivorStats } from '../../config/survivors';
import { EVENTS } from '../../config/waves';
import { FUSIONS, WEAPONS, WEAPON_IDS, type WeaponId } from '../../config/weapons';
import { addShake, banner, boom, textFx } from '../fx';
import { recalc } from '../stats';
import { SFX, sfx } from '../sfx';
import type { Card, World } from '../types';
import { isOnScreen } from '../view';
import { addPickup, heal, hitEnemy, killEnemy, nearest, queryEnemies } from './combat';
import { compactEnemies } from './enemies';
import { createWeapon } from './weapons';

// ---------- XP ----------

export function gainXp(w: World, v: number, raw = false): void {
  w.xp += raw ? v : v * w.st.xpMult;
  while (w.xp >= w.xpNext) {
    w.xp -= w.xpNext;
    w.level++;
    w.xpNext = xpForLevel(w.level);
    w.pendingLevels++;
  }
  if (w.pendingLevels > 0 && !w.choice) openLevelChoice(w);
}

export function updatePickups(w: World, dt: number): void {
  const p = w.player;
  if (p.deadAt !== null) return;
  const mag = w.st.magnet;
  const pool = w.pickups;
  for (let i = pool.count - 1; i >= 0; i--) {
    const k = pool.items[i]!;
    const dx = p.x - k.x;
    const dy = p.y - k.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    if (k.kind === 'gem' || k.kind === 'stim' || k.kind === 'coupon') {
      if (!k.pull && d < mag) k.pull = true;
      if (k.pull) {
        k.sp = (k.sp || XP.pullSpeed) + XP.pullAccel * dt;
        const step = Math.min(d, k.sp * dt);
        k.x += (dx / d) * step;
        k.y += (dy / d) * step;
      }
    }
    if (d >= p.r + k.r + 2) continue;
    const kind = k.kind;
    const val = k.val;
    const kx = k.x;
    const ky = k.y;
    if (kind === 'gem') w.gemCount--;
    pool.releaseAt(i);
    sfx(w, SFX.pickup);
    if (kind === 'gem') gainXp(w, val);
    else if (kind === 'stim') {
      w.cons.stim = Math.min(PLAYER.consumableMax, w.cons.stim + 1);
      textFx(w, 'pickup', p.x, p.y, 0, 'consumables.stim.name');
    } else if (kind === 'coupon') {
      w.coupons += val;
      textFx(w, 'pickup', p.x, p.y, val, 'pickups.coupons');
    } else if (kind === 'cache') {
      // Un nivel justo: la experiencia que falta para el siguiente, sin multiplicadores.
      w.coupons += COUPONS.cache;
      textFx(w, 'pickup', p.x, p.y, COUPONS.cache, 'pickups.coupons');
      gainXp(w, w.xpNext - w.xp, true);
    } else if (kind === 'chest') openItemChoice(w);
    else if (kind === 'medkit') {
      heal(w, p.maxHp * FIELD_PICKUPS.medkitHeal);
      textFx(w, 'pickup', p.x, p.y, 0, 'pickups.medkit');
    } else if (kind === 'magnet') {
      magnetPull(w);
      textFx(w, 'pickup', p.x, p.y, 0, 'pickups.magnet');
    } else if (kind === 'bomb') {
      screenBomb(w);
      textFx(w, 'pickup', p.x, p.y, 0, 'pickups.bomb');
    } else {
      const S = EVENTS.supply;
      for (let g = 0; g < S.gems; g++)
        addPickup(
          w,
          'gem',
          kx + (w.rng() - 0.5) * 50,
          ky + (w.rng() - 0.5) * 50,
          XP.gemRadius[S.gemValue] ?? 5,
          S.gemValue,
          true,
        );
      const id = CONSUMABLE_IDS[(w.rng() * CONSUMABLE_IDS.length) | 0]!;
      w.cons[id] = Math.min(PLAYER.consumableMax, w.cons[id] + 1);
      textFx(w, 'pickup', p.x, p.y, 0, `consumables.${id}.name`);
    }
    // Una tarjeta abierta para el mundo: el resto se recoge al cerrarla.
    if (w.choice) return;
  }
}

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
    if (!isFusion(wp.id) && wp.lvl < PLAYER.maxWeaponLevel) opts.push({ kind: 'up', id: wp.id });
  if (w.weapons.length < weaponSlots(w.charId, PLAYER.weaponSlots))
    for (const id of WEAPON_IDS) {
      if (isFusion(id) || owned.has(id) || blocked.has(id)) continue;
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
  return TRAIT_IDS.filter((id) => id !== blocked && w.tr[TRAITS[id].stat] < TRAITS[id].max);
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

export function openLevelChoice(w: World): void {
  const cards: Card[] = [];
  const fus = fusionOptions(w);
  if (fus.length) cards.push(fus[(w.rng() * fus.length) | 0]!);
  const wpool = weaponOptions(w);
  const tpool = traitOptions(w);
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
        tpool.map((id) => CARDS.traitBaseWeight + CARDS.traitPickBonus * (w.traitPicks[id] ?? 0)),
      );
      cards.push(makeTraitCard(w, tpool.splice(i, 1)[0]!));
    }
  }
  if (!cards.length) cards.push({ kind: 'heal' }, { kind: 'purge' });
  w.choice = { type: 'level', cards };
}

/** Cofre de jefe: 3 objetos que aún no lleva, a elegir uno (si le queda hueco). */
export function openItemChoice(w: World): void {
  if (w.items.length >= PLAYER.itemSlots) return;
  const ids = ITEM_IDS.filter((k) => !w.items.includes(k));
  const cards: Card[] = [];
  for (let i = 0; i < 3 && ids.length; i++)
    cards.push({ kind: 'item', id: ids.splice((w.rng() * ids.length) | 0, 1)[0]! });
  if (cards.length) w.choice = { type: 'item', cards };
}

export function reroll(w: World): boolean {
  if (w.rerolls > 0 && w.choice && w.choice.type === 'level') {
    w.rerolls--;
    openLevelChoice(w);
    return true;
  }
  return false;
}

export function applyChoice(w: World, i: number): void {
  const ch = w.choice;
  if (!ch) return;
  const c = ch.cards[i];
  if (!c) return;
  switch (c.kind) {
    case 'up': {
      const wp = w.weapons.find((x) => x.id === c.id);
      if (wp) wp.lvl++;
      break;
    }
    case 'new':
      w.weapons.push(createWeapon(c.id));
      break;
    case 'fusion': {
      const f = FUSIONS.find((x) => x.result === c.id);
      if (!f) break;
      w.weapons = w.weapons.filter((x) => x.id !== f.a && x.id !== f.b);
      w.weapons.push(createWeapon(c.id, PLAYER.maxWeaponLevel));
      banner(w, 'banner.fusion', { weapon: c.id });
      break;
    }
    case 'trait': {
      const T = TRAITS[c.id];
      const oldHp = w.player.hp;
      w.tr[T.stat] += c.value;
      w.traitPicks[c.id] = (w.traitPicks[c.id] ?? 0) + 1;
      recalc(w);
      if (T.stat === 'hp') w.player.hp = Math.min(w.player.maxHp, oldHp + c.value);
      break;
    }
    case 'item':
      w.items.push(c.id);
      recalc(w);
      break;
    case 'heal':
      heal(w, w.player.maxHp * CARDS.fallbackHeal);
      break;
    case 'purge':
      w.player.rad = Math.max(0, w.player.rad - CARDS.fallbackPurge);
      break;
  }
  w.choice = null;
  if (ch.type === 'level') {
    w.levelHistory.push(c.kind === 'trait' ? c.id : null);
    w.pendingLevels--;
    if (w.pendingLevels > 0) openLevelChoice(w);
  }
}

// ---------- recogibles de campo ----------

/** Imán: la chatarra y los estimulantes que se ven en pantalla vuelan hacia el jugador. */
function magnetPull(w: World): void {
  for (let i = 0; i < w.pickups.count; i++) {
    const k = w.pickups.items[i]!;
    if ((k.kind === 'gem' || k.kind === 'stim') && isOnScreen(w, k.x, k.y)) k.pull = true;
  }
}

/** Bomba: mata a todo enemigo que se vea en pantalla; a los jefes solo les hace daño. */
function screenBomb(w: World): void {
  const n = w.enemies.count;
  for (let i = 0; i < n; i++) {
    const e = w.enemies.items[i]!;
    if (e.dead || !isOnScreen(w, e.x, e.y, e.r)) continue;
    if (e.boss) hitEnemy(w, e, FIELD_PICKUPS.bombBossDmg, 'bomba', 0);
    else killEnemy(w, e, 'bomba');
  }
  compactEnemies(w);
  const p = w.player;
  boom(w, p.x, p.y, w.view.halfW * 1.4, 0.5, FX.colors.grenade);
  addShake(w, 10, 20);
}

// ---------- consumibles ----------

/** Usa el consumible del hueco `i` (teclas 5–8). Devuelve si se usó. */
export function consumeItem(w: World, i: number): boolean {
  if (w.over || w.choice || w.player.deadAt !== null) return false;
  const id: ConsumableId | undefined = CONSUMABLE_IDS[i];
  if (!id || !(w.cons[id] > 0)) return false;
  const p = w.player;
  if (id === 'stim') {
    if (p.hp >= p.maxHp) return false;
    heal(w, p.maxHp * CONSUMABLES.stim.heal);
  } else if (id === 'iodine') {
    if (p.rad <= 0) return false;
    p.rad = Math.max(0, Math.min(RAD.max, p.rad - CONSUMABLES.iodine.rad));
  } else if (id === 'grenade') {
    const G = CONSUMABLES.grenade;
    const t = nearest(w, p.x, p.y, G.range);
    if (!t) return false;
    const R = G.r * w.st.area;
    const tx = t.x;
    const ty = t.y;
    const out = w.qWeapon;
    // Se usa entre ticks: el spatial hash puede estar desfasado.
    w.enemyGrid.build(w.enemies.items, w.enemies.count);
    const k = queryEnemies(w, tx, ty, R, out);
    for (let q = 0; q < k; q++) {
      const e = w.enemies.items[out[q]!]!;
      hitEnemy(w, e, G.dmg, 'granada', 0, 2, tx, ty);
    }
    compactEnemies(w);
    boom(w, tx, ty, R, 0.35, FX.colors.grenade);
    addShake(w, 6, 12);
  } else {
    p.turbo = CONSUMABLES.turbo.dur * (1 + ((survivorStats(w.charId) as SurvivorStats).consDurPct ?? 0));
  }
  w.cons[id]--;
  w.consUsed++;
  return true;
}
