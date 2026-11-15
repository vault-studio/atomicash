// Armas de disparo: clavos, remachadora, jeringa, dardos, escopeta, rifle y núcleo de cobalto.
import { WEAPONS, scaled } from '../../../config/weapons';
import { type Weapon, type World } from '../../types';
import { nearest } from '../combat';
import { addShot } from './factories';
import { toughestInRange } from './targeting';

/** Pistola de clavos y remachadora: ráfaga al más cercano. */
export function fireNails(w: World, wp: Weapon): void {
  const p = w.player;
  const st = w.st;
  const lvl = wp.lvl;
  const isPistol = wp.id === 'pistola_clavos';
  const W = isPistol ? WEAPONS.pistola_clavos : WEAPONS.remachadora;
  const t = nearest(w, p.x, p.y, W.range);
  if (!t) {
    wp.cd = 0.05;
    return;
  }
  const n = isPistol ? lvl : WEAPONS.remachadora.count;
  const pierce = (isPistol ? 0 : WEAPONS.remachadora.pierce) + st.pierce;
  const base = Math.atan2(t.y - p.y, t.x - p.x);
  for (let i = 0; i < n; i++) {
    addShot(w, base + (i - (n - 1) / 2) * W.spread, W.speed, 4, W.range / W.speed, W.dmg, pierce, wp.id, 0.5);
  }
  wp.cd = (isPistol ? W.cd * Math.pow(WEAPONS.pistola_clavos.cdPerLvl, lvl - 1) : W.cd) * st.cdMult;
  return;
}

/** Jeringa y dardos incendiarios: abanico al más cercano. */
export function fireDarts(w: World, wp: Weapon): void {
  const p = w.player;
  const st = w.st;
  const lvl = wp.lvl;
  const isSyringe = wp.id === 'jeringa';
  const W = isSyringe ? WEAPONS.jeringa : WEAPONS.dardos_incendiarios;
  const t = nearest(w, p.x, p.y, W.range);
  if (!t) {
    wp.cd = 0.05;
    return;
  }
  const n = isSyringe ? 2 + lvl : WEAPONS.dardos_incendiarios.count;
  const base = Math.atan2(t.y - p.y, t.x - p.x);
  for (let i = 0; i < n; i++) {
    addShot(
      w,
      base + (i / (n - 1) - 0.5) * W.fan,
      W.speed,
      4,
      W.range / W.speed,
      W.dmg,
      st.pierce,
      wp.id,
      0.3,
    );
  }
  wp.cd = W.cd * st.cdMult;
  return;
}

/** Escopeta de chatarra: perdigones en cono. */
export function fireShotgun(w: World, wp: Weapon): void {
  const p = w.player;
  const st = w.st;
  const lvl = wp.lvl;
  const W = WEAPONS.escopeta_chatarra;
  const t = nearest(w, p.x, p.y, W.range);
  if (!t) {
    wp.cd = 0.05;
    return;
  }
  const n = W.pellets + W.pelletsPerLvl * (lvl - 1);
  const base = Math.atan2(t.y - p.y, t.x - p.x);
  for (let i = 0; i < n; i++) {
    const a = base + (w.rng() - 0.5) * W.cone;
    addShot(w, a, W.speed * (0.85 + w.rng() * 0.3), 3, W.life, W.dmg, st.pierce, wp.id, 1.2);
  }
  wp.cd = W.cd * st.cdMult;
  return;
}

/** Rifle de cerrojo: un tiro perforante al más duro. */
export function fireRifle(w: World, wp: Weapon): void {
  const p = w.player;
  const st = w.st;
  const lvl = wp.lvl;
  const W = WEAPONS.rifle_cerrojo;
  const t = toughestInRange(w, W.range);
  if (!t) {
    wp.cd = 0.05;
    return;
  }
  const a = Math.atan2(t.y - p.y, t.x - p.x);
  addShot(
    w,
    a,
    W.speed,
    5,
    W.range / W.speed,
    scaled(W.dmg, W.dmgPerLvl, lvl),
    W.pierce + st.pierce,
    wp.id,
    1,
  );
  wp.cd = W.cd * st.cdMult;
  return;
}

/** Núcleo de cobalto: bola lenta que atraviesa. */
export function fireCobalt(w: World, wp: Weapon): void {
  const p = w.player;
  const st = w.st;
  const lvl = wp.lvl;
  const W = WEAPONS.nucleo_cobalto;
  const t = nearest(w, p.x, p.y, W.speed * W.life);
  if (!t) {
    wp.cd = 0.05;
    return;
  }
  const a = Math.atan2(t.y - p.y, t.x - p.x);
  const dmg = scaled(W.dmg, W.dmgPerLvl, lvl) * (1 + W.radBonus * p.rad);
  addShot(w, a, W.speed, W.size * st.area, W.life, dmg, W.pierce + lvl + st.pierce, wp.id, 0.6);
  wp.cd = W.cd * st.cdMult;
  return;
}
