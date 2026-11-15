// Armas de cuerpo a cuerpo y auras: llaves orbitales, Geiger, núcleo inestable, martillo pilón y megáfono.
import { WEAPONS, scaled } from '../../../config/weapons';
import { FX } from '../../../config/run';
import { addShake, beamPoint, beamStart, boom } from '../../fx';
import { SFX } from '../../sfx';
import { type Weapon, type World } from '../../types';
import { HIT_DIRECT, HIT_MELEE, hitEnemy, nearest, queryEnemies } from '../combat';
import { TAU } from './factories';
import { chain } from './zaps';

export function fireOrbit(w: World, wp: Weapon, dt: number): void {
  const p = w.player;
  const st = w.st;
  const isDinamo = wp.id === 'dinamo';
  const W = isDinamo ? WEAPONS.dinamo : WEAPONS.llave;
  const n = isDinamo ? WEAPONS.dinamo.count : wp.lvl;
  const dmg = isDinamo ? WEAPONS.dinamo.dmg : scaled(WEAPONS.llave.dmg, WEAPONS.llave.dmgPerLvl, wp.lvl);
  const size = W.size * st.area;
  wp.a += W.spin * dt;
  const out = w.qWeapon;
  for (let i = 0; i < n; i++) {
    const an = wp.a + (i * TAU) / n;
    const x = p.x + Math.cos(an) * W.orbit;
    const y = p.y + Math.sin(an) * W.orbit;
    const k = queryEnemies(w, x, y, size, out);
    for (let q = 0; q < k; q++) {
      const e = w.enemies.items[out[q]!]!;
      if (e.dead || e.flying) continue;
      if (w.time - e.hitT[i]! < W.hitCd) continue;
      e.hitT[i] = w.time;
      hitEnemy(w, e, dmg, wp.id, HIT_DIRECT | HIT_MELEE, 1, p.x, p.y);
      if (isDinamo) chain(w, e, WEAPONS.dinamo.chainJumps, WEAPONS.dinamo.chainDmg, 'dinamo', e.x, e.y, true);
    }
  }
}

/** Aura alrededor del jugador (Geiger, núcleo inestable). */
function pulseAura(w: World, wp: Weapon, r: number, dmg: number): number {
  const p = w.player;
  const out = w.qWeapon;
  const k = queryEnemies(w, p.x, p.y, r, out);
  for (let q = 0; q < k; q++) hitEnemy(w, w.enemies.items[out[q]!]!, dmg, wp.id, 0, 0.15, p.x, p.y);
  return k;
}

/** Contador Geiger: aura que crece con el nivel y la RAD. */
export function fireGeiger(w: World, wp: Weapon, dt: number): void {
  const p = w.player;
  const st = w.st;
  const lvl = wp.lvl;
  const W = WEAPONS.geiger;
  wp.r = (W.r + W.rPerLvl * (lvl - 1) + W.rPerRad * p.rad) * st.area;
  wp.cd -= dt;
  if (wp.cd > 0) return;
  wp.cd = W.tickCd;
  pulseAura(w, wp, wp.r, scaled(W.dmg, W.dmgPerLvl, lvl));
  return;
}

/** Núcleo inestable: aura y rayos al azar a los de dentro. */
export function fireUnstable(w: World, wp: Weapon, dt: number): void {
  const p = w.player;
  const st = w.st;
  const out = w.qWeapon;
  const W = WEAPONS.nucleo_inestable;
  wp.r = (W.r + W.rPerRad * p.rad) * st.area;
  wp.cd -= dt;
  wp.cd2 -= dt;
  if (wp.cd <= 0) {
    wp.cd = W.tickCd;
    pulseAura(w, wp, wp.r, W.dmg);
  }
  if (wp.cd2 <= 0) {
    const k = queryEnemies(w, p.x, p.y, wp.r, out);
    if (k === 0) {
      wp.cd2 = 0.05;
      return;
    }
    wp.cd2 = W.boltCd * st.cdMult;
    const dmg = W.boltDmg * (1 + W.boltRadBonus * p.rad);
    for (let b = 0; b < W.bolts; b++) {
      const e = w.enemies.items[out[(w.rng() * k) | 0]!]!;
      if (e.dead) continue;
      const beam = beamStart(w, p.x, p.y, 0.1, FX.colors.unstable);
      beamPoint(beam, e.x, e.y);
      hitEnemy(w, e, dmg, wp.id, HIT_DIRECT);
    }
  }
  return;
}

/** Martillo pilón: golpe en área alrededor del jugador. */
export function fireHammer(w: World, wp: Weapon): void {
  const p = w.player;
  const st = w.st;
  const out = w.qWeapon;
  const lvl = wp.lvl;
  const W = WEAPONS.martillo_pilon;
  const R = (W.r + W.rPerLvl * (lvl - 1)) * st.area;
  const k = queryEnemies(w, p.x, p.y, R, out);
  let hits = 0;
  const dmg = scaled(W.dmg, W.dmgPerLvl, lvl);
  for (let q = 0; q < k; q++) {
    const e = w.enemies.items[out[q]!]!;
    if (e.flying || e.dead) continue;
    hits++;
    hitEnemy(w, e, dmg, wp.id, HIT_DIRECT | HIT_MELEE, W.kb, p.x, p.y);
  }
  if (hits === 0) {
    wp.cd = 0.05;
    return;
  }
  boom(w, p.x, p.y, R, 0.2, FX.colors.hammer, SFX.slam);
  addShake(w, 2);
  wp.cd = W.cd * st.cdMult;
  return;
}

/** Megáfono: cono de sonido que empuja. */
export function fireMegaphone(w: World, wp: Weapon): void {
  const p = w.player;
  const st = w.st;
  const out = w.qWeapon;
  const lvl = wp.lvl;
  const W = WEAPONS.megafono;
  const R = W.range * st.area;
  const t = nearest(w, p.x, p.y, R, true);
  if (!t) {
    wp.cd = 0.05;
    return;
  }
  const base = Math.atan2(t.y - p.y, t.x - p.x);
  const half = (W.angle + W.anglePerLvl * (lvl - 1)) / 2;
  const ux = Math.cos(base);
  const uy = Math.sin(base);
  const cosHalf = Math.cos(half);
  const dmg = scaled(W.dmg, W.dmgPerLvl, lvl);
  const kb = W.kb + W.kbPerLvl * (lvl - 1);
  const k = queryEnemies(w, p.x, p.y, R, out);
  for (let q = 0; q < k; q++) {
    const e = w.enemies.items[out[q]!]!;
    if (e.flying || e.dead) continue;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    if ((dx * ux + dy * uy) / d < cosHalf && d > e.r + p.r) continue;
    hitEnemy(w, e, dmg, wp.id, HIT_DIRECT, kb, p.x, p.y);
  }
  const beam = beamStart(
    w,
    p.x + Math.cos(base - half) * R,
    p.y + Math.sin(base - half) * R,
    0.15,
    FX.colors.cone,
    SFX.sonic,
  );
  beamPoint(beam, p.x, p.y);
  beamPoint(beam, p.x + Math.cos(base + half) * R, p.y + Math.sin(base + half) * R);
  wp.cd = W.cd * st.cdMult;
  return;
}
