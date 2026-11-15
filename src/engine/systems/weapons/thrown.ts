// Armas lanzadas: cóctel y petardos.
import { WEAPONS, scaled } from '../../../config/weapons';
import { SFX, sfx } from '../../sfx';
import { type Weapon, type World } from '../../types';
import { densestInRange, randomInRange } from './targeting';

/** Cóctel: botellas que caen delante de enemigos al azar. */
export function fireCocktail(w: World, wp: Weapon): void {
  const p = w.player;
  const st = w.st;
  const lvl = wp.lvl;
  const W = WEAPONS.coctel;
  let thrown = 0;
  for (let i = 0; i < lvl; i++) {
    const t = randomInRange(w, W.range);
    if (!t) break;
    const l = w.lobs.acquire();
    l.sx = p.x;
    l.sy = p.y;
    // Cae un poco por delante del bicho (hacia el jugador): como viene a por ti, se mete en el fuego.
    const dx = p.x - t.x;
    const dy = p.y - t.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const lead = Math.min(W.lead, d * 0.5) / d;
    l.tx = t.x + dx * lead;
    l.ty = t.y + dy * lead;
    l.t = 0;
    l.dur = W.flight;
    l.lvl = lvl;
    thrown++;
    sfx(w, SFX.throw);
  }
  wp.cd = thrown === 0 ? 0.1 : W.cd * st.cdMult;
  return;
}

/** Petardos: ristra sobre la zona con más enemigos. */
export function fireFirecrackers(w: World, wp: Weapon): void {
  const p = w.player;
  const st = w.st;
  const lvl = wp.lvl;
  const W = WEAPONS.petardos;
  const t = densestInRange(w, W.range, W.samples, W.crowdR);
  if (!t) {
    wp.cd = 0.1;
    return;
  }
  const n = W.count[Math.min(lvl, W.count.length) - 1]!;
  const r = (W.r + W.rPerLvl * (lvl - 1)) * st.area;
  const dmg = scaled(W.dmg, W.dmgPerLvl, lvl);
  const spread = W.spread * st.area;
  for (let i = 0; i < n && w.mines.count < W.maxMines; i++) {
    // Reparto uniforme en el disco: raíz del radio.
    const a = w.rng() * Math.PI * 2;
    const d = Math.sqrt(w.rng()) * spread;
    const m = w.mines.acquire();
    m.sx = p.x;
    m.sy = p.y;
    m.x = t.x + Math.cos(a) * d;
    m.y = t.y + Math.sin(a) * d;
    // Los de atrás vuelan un poco más: la ristra cae estirada.
    m.flyDur = m.fly = W.flight * (1 + 0.25 * (i / n));
    m.t = W.chain * i;
    m.r = r;
    m.dmg = dmg;
  }
  wp.cd = Math.max(0.3, W.cd + W.cdPerLvl * (lvl - 1)) * st.cdMult;
  return;
}
