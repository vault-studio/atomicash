// Avance de disparos, botellas, charcos y petardos ya lanzados.
import { WEAPONS, scaled } from '../../../config/weapons';
import { FX } from '../../../config/run';
import { boom } from '../../fx';
import { SFX, sfx } from '../../sfx';
import { SHOT_HITS, type Shot, type World } from '../../types';
import { hitsObstacle } from '../../obstacles';
import { HIT_DIRECT, HIT_KB_DIR, hitEnemy, queryEnemies } from '../combat';
import { touchFire } from './burns';
import { addFirePool } from './factories';

function endShot(w: World, s: Shot): void {
  if (s.src === 'dardos_incendiarios') {
    const W = WEAPONS.dardos_incendiarios;
    addFirePool(w, s.x, s.y, W.poolR * w.st.area, W.poolDur, W.poolDmg, WEAPONS.coctel.poolTick, s.src);
  }
}

export function updateShots(w: World, dt: number): void {
  const pool = w.shots;
  const out = w.qWeapon;
  for (let i = pool.count - 1; i >= 0; i--) {
    const s = pool.items[i]!;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.life -= dt;
    let done = s.life <= 0 || hitsObstacle(w, s.x, s.y);
    if (!done) {
      const k = queryEnemies(w, s.x, s.y, s.r, out);
      for (let q = 0; q < k; q++) {
        const e = w.enemies.items[out[q]!]!;
        if (e.dead) continue;
        let dup = false;
        for (let h = 0; h < s.nHit; h++) if (s.hit[h] === e.id) dup = true;
        if (dup) continue;
        if (s.nHit < SHOT_HITS) s.hit[s.nHit++] = e.id;
        hitEnemy(w, e, s.dmg, s.src, s.direct ? HIT_DIRECT | HIT_KB_DIR : HIT_KB_DIR, s.kb, s.vx, s.vy);
        if (s.pierce-- <= 0 || s.nHit >= SHOT_HITS) {
          done = true;
          break;
        }
      }
    }
    if (done) {
      endShot(w, s);
      pool.releaseAt(i);
    }
  }
}

export function updateLobs(w: World, dt: number): void {
  const W = WEAPONS.coctel;
  for (let i = w.lobs.count - 1; i >= 0; i--) {
    const l = w.lobs.items[i]!;
    l.t += dt;
    if (l.t < l.dur) continue;
    const life = W.dur + W.durPerLvl * (l.lvl - 1);
    sfx(w, SFX.molotov, l.tx, l.ty);
    addFirePool(
      w,
      l.tx,
      l.ty,
      W.poolR * w.st.area,
      life,
      scaled(W.dmg, W.dmgPerLvl, l.lvl),
      W.poolTick,
      'coctel',
      scaled(W.burn.dps, W.dmgPerLvl, l.lvl),
    );
    w.lobs.releaseAt(i);
  }
}

export function updateFirePools(w: World, dt: number): void {
  const out = w.qWeapon;
  for (let i = w.pools.count - 1; i >= 0; i--) {
    const pl = w.pools.items[i]!;
    pl.life -= dt;
    pl.tick -= dt;
    // La quemadura se mira cada tick: así no se escapa quien cruza el charco deprisa.
    if (pl.burn > 0) {
      const k = queryEnemies(w, pl.x, pl.y, pl.r, out);
      for (let q = 0; q < k; q++) {
        const e = w.enemies.items[out[q]!]!;
        if (!e.flying && !e.dead) touchFire(w, e, pl.burn, dt);
      }
    }
    if (pl.tick <= 0) {
      pl.tick = pl.tickCd;
      const k = queryEnemies(w, pl.x, pl.y, pl.r, out);
      for (let q = 0; q < k; q++) {
        const e = w.enemies.items[out[q]!]!;
        // Uno por intervalo aunque pise varios charcos solapados: el daño de zona no se apila en un solo blanco.
        if (e.flying || w.time - e.poolAt < pl.tickCd * 0.99) continue;
        e.poolAt = w.time;
        hitEnemy(w, e, pl.dmg, pl.src, 0);
      }
    }
    if (pl.life <= 0) w.pools.releaseAt(i);
  }
}

export function updateMines(w: World, dt: number): void {
  const W = WEAPONS.petardos;
  const out = w.qWeapon;
  for (let i = w.mines.count - 1; i >= 0; i--) {
    const m = w.mines.items[i]!;
    if (m.fly > 0) {
      m.fly -= dt;
      continue;
    }
    m.t -= dt;
    if (m.t > 0) continue;
    const k = queryEnemies(w, m.x, m.y, m.r, out);
    for (let q = 0; q < k; q++) {
      const e = w.enemies.items[out[q]!]!;
      if (e.flying || e.dead) continue;
      hitEnemy(w, e, m.dmg, 'petardos', 0, W.kb, m.x, m.y);
      if (!e.boss) e.stun = Math.max(e.stun, W.stun);
    }
    boom(w, m.x, m.y, m.r, 0.18, FX.colors.mine, SFX.pop);
    w.mines.releaseAt(i);
  }
}
