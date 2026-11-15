// Elecciones abiertas: subida de nivel, cofre de jefe, caja; desterrar, bloquear, cambiar y aplicar la elegida.
import { ITEM_IDS } from '../../../config/items';
import { CACHE_ROLL, PLAYER } from '../../../config/run';
import { CARDS, TRAITS } from '../../../config/traits';
import { FUSIONS } from '../../../config/weapons';
import { banner, textFx } from '../../fx';
import { recalc } from '../../stats';
import type { Card, World } from '../../types';
import { addCoupons, heal } from '../combat';
import { chooseEndless } from '../modes';
import { createWeapon } from '../weapons';
import { notePick } from '../../runStats';
import { cardKey, rollLevelCards, stillValid } from './cardOptions';
import { gainXp } from './pickups';

export function openLevelChoice(w: World): void {
  if (w.locked && !stillValid(w, w.locked)) w.locked = null;
  const cards = rollLevelCards(w, w.locked);
  if (!cards.length) cards.push({ kind: 'heal' }, { kind: 'purge' });
  w.choice = { type: 'level', cards };
}

/**
 * Destierra la tarjeta `i` (gasta un destierro): esa arma o rasgo no vuelve a salir en la run y en su hueco sale otra.
 */
export function banishCard(w: World, i: number): boolean {
  const ch = w.choice;
  const c = ch?.cards[i];
  if (!ch || ch.type !== 'level' || !c || w.banishes <= 0) return false;
  if (c.kind !== 'up' && c.kind !== 'new' && c.kind !== 'trait') return false;
  w.banishes--;
  const k = cardKey(c);
  w.banished.add(k);
  if (w.locked && cardKey(w.locked) === k) w.locked = null;
  const others = new Set(ch.cards.map(cardKey));
  const fresh = rollLevelCards(w, null).find((x) => !others.has(cardKey(x)));
  const cards = ch.cards.slice();
  if (fresh) cards[i] = fresh;
  else cards.splice(i, 1);
  if (!cards.length) cards.push({ kind: 'heal' }, { kind: 'purge' });
  w.choice = { type: 'level', cards };
  return true;
}

/**
 * Bloquea la tarjeta `i` (gasta un candado): se queda al cambiar las tarjetas y, si eliges otra, vuelve en la
 * próxima subida. Bloquear la que ya lo está la suelta (sin devolver el candado).
 */
export function lockCard(w: World, i: number): boolean {
  const ch = w.choice;
  const c = ch?.cards[i];
  if (!ch || ch.type !== 'level' || !c) return false;
  if (w.locked && cardKey(w.locked) === cardKey(c)) w.locked = null;
  else {
    if (w.locks <= 0 || c.kind === 'heal' || c.kind === 'purge') return false;
    w.locks--;
    w.locked = c;
  }
  // Elección nueva (misma mano) para que la UI se entere.
  w.choice = { ...ch };
  return true;
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

/**
 * Cofre especial: tragaperras de cupones. La UI hace girar los rodillos y al cobrar se suma un nivel. Con
 * `CACHE_ROLL.capAfter` cupones ya recogidos en la partida, el premio sale de `CACHE_ROLL.capped`.
 */
export function openCacheChoice(w: World): void {
  const capped = w.coupons >= CACHE_ROLL.capAfter;
  const roll = (x: number): number => {
    if (capped) {
      const [lo, hi] = CACHE_ROLL.capped;
      return lo + Math.floor(w.rng() * (hi - lo + 1));
    }
    let tier: readonly [number, number, number] = CACHE_ROLL.tiers[CACHE_ROLL.tiers.length - 1]!;
    for (const t of CACHE_ROLL.tiers) {
      if (x < t[0]) {
        tier = t;
        break;
      }
      x -= t[0];
    }
    return tier[1] + Math.floor(w.rng() * (tier[2] - tier[1] + 1));
  };
  let n = roll(w.rng());
  // Único «Contrabandista»: tira dos veces y se queda con la mejor.
  if (w.mods.smuggler) n = Math.max(n, roll(w.rng()));
  w.choice = { type: 'cache', cards: [{ kind: 'coupons', n }] };
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
  // Tras el Coloso: 0 = seguir en infinito, 1 = terminar.
  if (ch.type === 'endless') return chooseEndless(w, i === 0);
  const c = ch.cards[i];
  if (!c) return;
  notePick(w.rs, w.time, c.kind, 'id' in c ? c.id : c.kind);
  switch (c.kind) {
    case 'up': {
      const wp = w.weapons.find((x) => x.id === c.id);
      if (wp) wp.lvl++;
      break;
    }
    case 'new':
      w.weapons.push(createWeapon(c.id, 1, w.time));
      break;
    case 'fusion': {
      const f = FUSIONS.find((x) => x.result === c.id);
      if (!f) break;
      w.weapons = w.weapons.filter((x) => x.id !== f.a && x.id !== f.b);
      // La especialidad del árbol en el arma inicial pasa a su fusión.
      if (w.starter === f.a || w.starter === f.b) w.starter = c.id;
      w.weapons.push(createWeapon(c.id, PLAYER.maxWeaponLevel, w.time));
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
    case 'coupons':
      textFx(w, 'pickup', w.player.x, w.player.y, addCoupons(w, c.n), 'pickups.coupons');
      break;
    case 'heal':
      heal(w, w.player.maxHp * CARDS.fallbackHeal);
      break;
    case 'purge':
      w.player.rad = Math.max(0, w.player.rad - CARDS.fallbackPurge);
      break;
  }
  w.choice = null;
  if (ch.type === 'level' && w.locked && cardKey(w.locked) === cardKey(c)) w.locked = null;
  if (ch.type === 'level') {
    w.levelHistory.push(c.kind === 'trait' ? c.id : null);
    w.pendingLevels--;
    if (w.pendingLevels > 0) openLevelChoice(w);
  } else if (ch.type === 'cache') {
    // Un nivel justo: la experiencia que falta para el siguiente, sin multiplicadores.
    gainXp(w, w.xpNext - w.xp, true);
  }
}
