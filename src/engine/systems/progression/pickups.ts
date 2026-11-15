// Experiencia, recogida de lo que hay en el suelo, power-ups de campo (imán, bomba, crio) y consumibles.
import {
  CONSUMABLES,
  CONSUMABLE_IDS,
  FIELD_PICKUPS,
  FIELD_PICKUP_IDS,
  type ConsumableId,
} from '../../../config/items';
import { RAD } from '../../../config/radiation';
import { FX, JUICE, PLAYER, XP, xpForLevel } from '../../../config/run';
import { survivorStats, type SurvivorStats } from '../../../config/survivors';
import { EVENTS } from '../../../config/waves';
import { addShake, boom, burst, hitStop, textFx } from '../../fx';
import { SFX, sfx } from '../../sfx';
import type { PickupKind, World } from '../../types';
import { isOnScreen } from '../../view';
import { addCoupons, addPickup, heal, hitEnemy, killEnemy, nearest, queryEnemies } from '../combat';
import { compactEnemies } from '../enemies';
import { noteLevel, noteXp } from '../../runStats';
import { openCacheChoice, openItemChoice, openLevelChoice } from './choices';

// ---------- XP ----------

export function gainXp(w: World, v: number, raw = false): void {
  const xp = raw ? v : v * w.st.xpMult;
  w.xp += xp;
  noteXp(w.rs, w.time, xp);
  while (w.xp >= w.xpNext) {
    w.xp -= w.xpNext;
    w.level++;
    if (w.mods.levelHeal && w.player.deadAt === null) heal(w, (w.player.maxHp * w.mods.levelHeal) / 100);
    noteLevel(w.rs, w.level, w.time);
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
    if (k.pull || k.kind === 'gem' || k.kind === 'stim' || k.kind === 'coupon') {
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
      textFx(w, 'pickup', p.x, p.y, addCoupons(w, val), 'pickups.coupons');
    } else if (kind === 'cache') {
      // La máquina de cupones sale tras la cinemática de victoria, que mantiene el zoom hasta cobrarla.
      openCacheChoice(w);
      w.victory = true;
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
    } else if (kind === 'freeze') {
      screenFreeze(w);
      textFx(w, 'pickup', p.x, p.y, 0, 'pickups.freeze');
    } else if (kind === 'nuka') {
      p.nuka = FIELD_PICKUPS.nuka;
      burst(w, p.x, p.y, 16, NUKA_SPARKS, 0.8);
      textFx(w, 'pickup', p.x, p.y, 0, 'pickups.nuka');
    } else if (kind === 'boots') {
      p.boots = FIELD_PICKUPS.boots;
      burst(w, p.x, p.y, 12, BOOT_DUST, 0.8);
      textFx(w, 'pickup', p.x, p.y, 0, 'pickups.boots');
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

// ---------- recogibles de campo ----------

/** Lo que el imán atrae: experiencia, estimulantes, cupones y power-ups (no cofres ni cajas). */
const MAGNETIC: ReadonlySet<PickupKind> = new Set<PickupKind>(['gem', 'stim', 'coupon', ...FIELD_PICKUP_IDS]);

/** Imán: todo lo que atrae, en cualquier parte del mapa, vuela hacia el jugador. */
export function magnetPull(w: World): void {
  for (let i = 0; i < w.pickups.count; i++) {
    const k = w.pickups.items[i]!;
    if (MAGNETIC.has(k.kind)) k.pull = true;
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
  hitStop(w, JUICE.hitStop.bomb);
}

const NUKA_SPARKS = [0xff3d6a, 0xffe14a, 0xffffff] as const;
const BOOT_DUST = [0xe8a33a, 0xd6c38a, 0xffffff] as const;
const ICE = [0xbfefff, 0x7fd8ff, 0xffffff] as const;

/** Crio-granada: congela a todo enemigo que se vea en pantalla (a los jefes, menos rato). */
function screenFreeze(w: World): void {
  const F = FIELD_PICKUPS;
  for (let i = 0; i < w.enemies.count; i++) {
    const e = w.enemies.items[i]!;
    if (e.dead || !isOnScreen(w, e.x, e.y, e.r)) continue;
    e.frozen = e.boss ? F.freezeBoss : F.freeze;
    burst(w, e.x, e.y, 2, ICE, 0.5);
  }
  const p = w.player;
  boom(w, p.x, p.y, w.view.halfW * 1.4, 0.45, FX.colors.freeze);
  hitStop(w, JUICE.hitStop.grenade);
}

// ---------- consumibles ----------

/** Usa el consumible del hueco `i` (teclas 1–4). Devuelve si se usó. */
export function consumeItem(w: World, i: number): boolean {
  if (w.over || w.choice || w.player.deadAt !== null) return false;
  const id: ConsumableId | undefined = CONSUMABLE_IDS[i];
  if (!id || !(w.cons[id] > 0)) return false;
  const p = w.player;
  if (id === 'stim') {
    if (p.hp >= p.maxHp) return false;
    heal(w, p.maxHp * CONSUMABLES.stim.heal * (1 + (w.mods.stimHeal ?? 0) / 100));
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
    hitStop(w, JUICE.hitStop.grenade);
  } else {
    const ch = survivorStats(w.charId) as SurvivorStats;
    p.turbo = CONSUMABLES.turbo.dur * (1 + (ch.consDurPct ?? 0) + (w.mods.consDur ?? 0) / 100);
  }
  if (!(w.mods.consSave && w.rng() < w.mods.consSave / 100)) w.cons[id]--;
  w.consUsed++;
  return true;
}
