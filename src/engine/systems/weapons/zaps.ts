// Rayos: cadena de la tesla y desfibrilador.
import { WEAPONS, scaled, type WeaponId } from '../../../config/weapons';
import { FX } from '../../../config/run';
import { beamPoint, beamStart } from '../../fx';
import { SFX } from '../../sfx';
import { type Enemy, type Weapon, type World } from '../../types';
import { hitEnemy, nearest, queryEnemies } from '../combat';
import { nearIdx, nearestN } from './targeting';

const seen = new Int32Array(32);

/** Rayo que salta de `first` a los enemigos más cercanos no tocados. */
export function chain(
  w: World,
  first: Enemy,
  jumps: number,
  dmg: number,
  src: WeaponId,
  ox: number,
  oy: number,
  skipFirst: boolean,
): void {
  const J = WEAPONS.tesla.jump;
  const out = w.qChain;
  let ns = 0;
  seen[ns++] = first.id;
  const beam = beamStart(w, ox, oy, 0.12, FX.colors.chain, SFX.tesla);
  beamPoint(beam, first.x, first.y);
  if (!skipFirst) hitEnemy(w, first, dmg, src, 0);
  let cx = first.x;
  let cy = first.y;
  for (let j = 0; j < jumps; j++) {
    let best: Enemy | null = null;
    let bd = J * J;
    const k = queryEnemies(w, cx, cy, J, out);
    for (let q = 0; q < k; q++) {
      const e = w.enemies.items[out[q]!]!;
      if (e.dead) continue;
      let dup = false;
      for (let s = 0; s < ns; s++) if (seen[s] === e.id) dup = true;
      if (dup) continue;
      const dx = e.x - cx;
      const dy = e.y - cy;
      const dd = dx * dx + dy * dy;
      if (dd < bd) {
        bd = dd;
        best = e;
      }
    }
    if (!best) break;
    if (ns < seen.length) seen[ns++] = best.id;
    beamPoint(beam, best.x, best.y);
    cx = best.x;
    cy = best.y;
    hitEnemy(w, best, dmg, src, 0);
  }
}

/** Bobina tesla: rayo que salta entre enemigos. */
export function fireTesla(w: World, wp: Weapon): void {
  const p = w.player;
  const st = w.st;
  const lvl = wp.lvl;
  const W = WEAPONS.tesla;
  const t = nearest(w, p.x, p.y, W.range);
  if (!t) {
    wp.cd = 0.05;
    return;
  }
  chain(w, t, W.jumps + W.jumpsPerLvl * (lvl - 1), scaled(W.dmg, W.dmgPerLvl, lvl), 'tesla', p.x, p.y, false);
  wp.cd = W.cd * st.cdMult;
  return;
}

/** Desfibrilador: descargas a los más cercanos. */
export function fireDefib(w: World, wp: Weapon): void {
  const p = w.player;
  const st = w.st;
  const lvl = wp.lvl;
  const W = WEAPONS.desfibrilador;
  const k = nearestN(w, W.range, W.targets + lvl);
  if (k === 0) {
    wp.cd = 0.05;
    return;
  }
  const dmg = scaled(W.dmg, W.dmgPerLvl, lvl) * (1 + W.regenBonus * st.regen);
  for (let i = 0; i < k; i++) {
    const e = w.enemies.items[nearIdx[i]!]!;
    const beam = beamStart(w, p.x, p.y, 0.1, FX.colors.zap, SFX.defib);
    beamPoint(beam, e.x, e.y);
    hitEnemy(w, e, dmg, wp.id, 0, W.kb, p.x, p.y);
  }
  wp.cd = W.cd * st.cdMult;
  return;
}
