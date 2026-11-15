// Muerte de un enemigo: botín, restos (cadáver o chatarra), recuento de bajas y efectos de élite al morir.
import { AI, ELITES, ENEMY_STATS, GORE, GORE_IRR, type EnemyStats } from '../../../config/enemies';
import { DROPS, FIELD_PICKUPS } from '../../../config/items';
import { IRRADIATED } from '../../../config/radiation';
import { BUILDINGS } from '../../../config/props';
import { COUPONS, FX, JUICE, SUMMARY, XP, streakMult } from '../../../config/run';
import { CAMPAIGN, LAST_ACT } from '../../../config/acts';
import { EVENTS } from '../../../config/waves';
import { WEAPONS, type DamageSource } from '../../../config/weapons';
import { addShake, banner, burst, hitStop } from '../../fx';
import { noteKill } from '../../runStats';
import { SFX, sfx } from '../../sfx';
import { type Enemy, type World } from '../../types';
import { spawnEnemy } from '../enemies';
import { colossusDown, objectiveKill } from '../modes';
import { addChest, addPickup, dropGems, dropKillGems, rollFieldPickup } from './drops';
import { spriteIdFor } from './hit';
import { heal } from './player';

function addCorpse(w: World, e: Enemy): void {
  let c;
  if (w.corpses.count < FX.maxCorpses) c = w.corpses.acquire();
  else {
    // Lleno: reutiliza el más antiguo.
    let oi = 0;
    for (let i = 1; i < w.corpses.count; i++) if (w.corpses.items[i]!.t < w.corpses.items[oi]!.t) oi = i;
    c = w.corpses.items[oi]!;
  }
  c.sprite = spriteIdFor(e);
  c.x = e.x;
  c.y = e.y;
  c.facingX = e.facingX;
  c.facingY = e.facingY;
  c.t = w.time;
  c.flying = e.flying;
  c.irr = e.irr;
}

/** Un robot revienta: deja sus restos y, si no es de los pequeños, suena a explosión. */
function addWreck(w: World, e: Enemy): void {
  let c;
  if (w.wrecks.count < FX.maxWrecks) c = w.wrecks.acquire();
  else {
    // Lleno: reutiliza el que antes iba a desaparecer.
    let oi = 0;
    for (let i = 1; i < w.wrecks.count; i++) if (w.wrecks.items[i]!.until < w.wrecks.items[oi]!.until) oi = i;
    c = w.wrecks.items[oi]!;
  }
  c.sprite = e.type;
  c.x = e.x;
  c.y = e.y;
  c.t = w.time;
  c.until = w.time + (e.boss ? FX.wreckBossTime : FX.wreckTime);
  c.seed = w.fxRng();
  c.flying = e.flying;
  c.elite = e.elite !== null;
  if (e.r >= FX.wreckLoudR) sfx(w, SFX.boom, e.x, e.y);
}

/** Bajas por segundo en un anillo de `SUMMARY.window` s (para «más bajas en 5 s») y por tramo de la gráfica. */
function countKill(w: World): void {
  const sec = Math.floor(w.time);
  const W = SUMMARY.window;
  if (sec !== w.killSec) {
    for (let s = w.killSec + 1; s <= sec && s - w.killSec <= W; s++) w.killRing[s % W] = 0;
    w.killSec = sec;
  }
  w.killRing[sec % W] = w.killRing[sec % W]! + 1;
  let sum = 0;
  for (let i = 0; i < W; i++) sum += w.killRing[i]!;
  if (sum > w.peakKills5) w.peakKills5 = sum;
  const tb = Math.floor(w.time / SUMMARY.bucket);
  while (w.timeKills.length <= tb) w.timeKills.push(0);
  w.timeKills[tb] = w.timeKills[tb]! + 1;
}

export function killEnemy(w: World, e: Enemy, src: DamageSource): void {
  if (e.dead) return;
  noteKill(w.rs, e.type, w.time, e.hitAt >= e.born ? e.hitAt : -1);
  e.dead = true;
  w.kills++;
  countKill(w);
  objectiveKill(w);
  const before = streakMult(w.streak);
  w.streak++;
  if (w.streak > w.bestStreak) w.bestStreak = w.streak;
  const mult = streakMult(w.streak);
  if (mult !== before) {
    banner(w, 'banner.streak', { n: String(w.streak), mult: String(mult) });
    sfx(w, SFX.pickup);
  }
  const stats = ENEMY_STATS[e.type] as EnemyStats;
  sfx(w, stats.metal ? SFX.killMetal : SFX.kill, e.x, e.y);
  if (stats.wreck) addWreck(w, e);
  else addCorpse(w, e);
  const gore = e.irr ? GORE_IRR : GORE[e.type];
  if (e.boss) {
    burst(w, e.x, e.y, JUICE.parts.perBossKill, gore, 2);
    hitStop(w, JUICE.hitStop.boss);
    addShake(w, 14, 20);
  } else if (stats.wreck) burst(w, e.x, e.y, JUICE.parts.perWreck, gore, 1.6);
  else burst(w, e.x, e.y, JUICE.parts.perKill, gore, e.irr ? 1.4 : 1);
  const xp = e.xp * XP.killMult * (e.irr ? IRRADIATED.xp : 1) * (w.rain > 0 ? EVENTS.rain.xpMult : 1) * mult;
  if (xp > 0) {
    if (e.boss) dropGems(w, e.x, e.y, xp);
    else dropKillGems(w, e.x, e.y, xp, e.irr ? XP.rareGems : XP.killGems);
  }
  if (e.elite) {
    // Power-up siempre y, a veces, también el cofre especial (a un lado para que no se recojan juntos).
    addPickup(w, rollFieldPickup(w.rng()), e.x, e.y, FIELD_PICKUPS.r);
    if (w.rng() < ELITES.cacheChance) addChest(w, 'cache', e.x + 40, e.y + 40, BUILDINGS.cache.r);
    banner(w, 'banner.eliteDown');
    hitStop(w, JUICE.hitStop.bomb);
    addShake(w, 6);
    if (e.elite === 'divisor') {
      const D = ELITES.divisor;
      for (let i = 0; i < D.split; i++) {
        const a = (i / D.split) * Math.PI * 2;
        spawnEnemy(w, e.type, e.x + Math.cos(a) * D.splitDist, e.y + Math.sin(a) * D.splitDist, false);
      }
    }
  } else if (e.gar >= 0) {
    const g = w.garrisons[e.gar]!;
    if (--g.left === 0) {
      // La copia del evento «Tú mismo, otra vez» no tiene edificio: el cofre cae donde muere.
      const mirror = e.skin !== null;
      addChest(w, 'cache', mirror ? e.x : g.x, mirror ? e.y : g.y, BUILDINGS.cache.r);
      banner(w, mirror ? 'banner.mirrorWon' : 'banner.cache');
    }
  } else if (!e.boss && w.rng() < COUPONS.dropChance) {
    addPickup(w, 'coupon', e.x, e.y, COUPONS.r, COUPONS.drop);
  }
  if (e.boss) {
    w.bosses++;
    w.bossAlive--;
    if (e.type === 'rey_rata' || e.type === 'dirigible') {
      addChest(w, 'chest', e.x, e.y, 14);
      banner(w, 'banner.chest');
    }
    if (e.type === 'dirigible') dropGems(w, e.x, e.y, AI.dirigible.dropXp);
    // El Coloso gana la run (y pregunta si seguir en infinito); en infinito solo es un jefe más.
    if (e.type === 'coloso' && !w.endless) colossusDown(w);
    // Cae el jefe del acto: la limpieza se hace fuera de los bucles que recorren enemigos (`updateCampaign`).
    else if (w.act < LAST_ACT && e.type === CAMPAIGN.acts[w.act].boss) w.actBossDown = true;
  }
  if (e.type === 'hinchado' && w.blasts.count < w.blasts.items.length) {
    // Se resuelve después (resolveBlasts): puede morir dentro de un bucle que ya recorre una consulta.
    const b = w.blasts.acquire();
    b.x = e.x;
    b.y = e.y;
  }
  if (e.type === 'aspiradora') {
    const A = AI.aspiradora;
    for (let i = 0; i < A.children; i++) {
      const a = (i / A.children) * Math.PI * 2;
      const c = spawnEnemy(
        w,
        A.childType,
        e.x + Math.cos(a) * A.childDist,
        e.y + Math.sin(a) * A.childDist,
        false,
      );
      c.facingX = e.facingX;
      c.facingY = e.facingY;
    }
  }
  if (src === 'jeringa' || src === 'dardos_incendiarios') {
    let lvl = 0;
    for (const wp of w.weapons) if (wp.id === src) lvl = wp.lvl;
    if (lvl > 0) {
      const W = WEAPONS.jeringa;
      const want = src === 'jeringa' ? W.healBase + W.healPerLvl * lvl : WEAPONS.dardos_incendiarios.healBase;
      const a = Math.min(want, w.player.healBudget);
      w.player.healBudget -= a;
      heal(w, a);
    }
  }
  if (w.rng() < DROPS.stimChance * (1 + w.st.luck / 50)) addPickup(w, 'stim', e.x, e.y, 7);
  else if (w.rng() < FIELD_PICKUPS.chance * (1 + w.st.luck / 50))
    addPickup(w, rollFieldPickup(w.rng()), e.x, e.y, FIELD_PICKUPS.r);
}
