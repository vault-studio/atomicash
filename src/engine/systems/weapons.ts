// Armas automáticas (F1-06, F2-01): disparo, proyectiles, charcos, petardos y rayos.
// Sin allocations: proyectiles y efectos salen de pools; las consultas usan buffers del World.
import { WEAPONS, scaled, type WeaponId } from '../../config/weapons';
import { FX } from '../../config/run';
import { addShake, beamPoint, beamStart, boom } from '../fx';
import {
  SHOT_HITS,
  type Enemy,
  type FirePool,
  type Lob,
  type Mine,
  type Shot,
  type Weapon,
  type World,
} from '../types';
import { HIT_DIRECT, HIT_KB_DIR, HIT_MELEE, hitEnemy, nearest, queryEnemies } from './combat';

const TAU = Math.PI * 2;

export const createShot = (): Shot => ({
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  r: 0,
  life: 0,
  dmg: 0,
  pierce: 0,
  src: 'pistola_clavos',
  direct: true,
  kb: 0,
  hit: new Int32Array(SHOT_HITS),
  nHit: 0,
});
export const createLob = (): Lob => ({ sx: 0, sy: 0, tx: 0, ty: 0, t: 0, dur: 0, lvl: 1 });
export const createFirePool = (): FirePool => ({
  x: 0,
  y: 0,
  r: 0,
  life: 0,
  max: 0,
  tick: 0,
  tickCd: 0,
  dmg: 0,
  src: 'coctel',
});
export const createMine = (): Mine => ({ x: 0, y: 0, t: 0, r: 0, dmg: 0 });

export function createWeapon(id: WeaponId, lvl = 1): Weapon {
  return { id, lvl, cd: 0.3, a: 0, r: 0, dist: 0, lx: NaN, ly: NaN, cd2: 0 };
}

function addShot(
  w: World,
  a: number,
  speed: number,
  r: number,
  life: number,
  dmg: number,
  pierce: number,
  src: WeaponId,
  kb: number,
): void {
  const p = w.player;
  const s = w.shots.acquire();
  s.x = p.x;
  s.y = p.y;
  s.vx = Math.cos(a) * speed;
  s.vy = Math.sin(a) * speed;
  s.r = r;
  s.life = life;
  s.dmg = dmg;
  s.pierce = pierce;
  s.src = src;
  s.direct = true;
  s.kb = kb;
  s.nHit = 0;
}

function addFirePool(
  w: World,
  x: number,
  y: number,
  r: number,
  life: number,
  dmg: number,
  tickCd: number,
  src: WeaponId,
): void {
  const pl = w.pools.acquire();
  pl.x = x;
  pl.y = y;
  pl.r = r;
  pl.life = pl.max = life;
  pl.tick = 0;
  pl.tickCd = tickCd;
  pl.dmg = dmg;
  pl.src = src;
}

const seen = new Int32Array(32);

/** Rayo que salta de `first` a los enemigos más cercanos no tocados. */
function chain(
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
  const beam = beamStart(w, ox, oy, 0.12, FX.colors.chain);
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

/** Enemigo al azar (de suelo) dentro de `range`, por muestreo de embalse. */
function randomInRange(w: World, range: number): Enemy | null {
  const p = w.player;
  const R2 = range * range;
  let pick: Enemy | null = null;
  let seenN = 0;
  for (let i = 0, n = w.enemies.count; i < n; i++) {
    const e = w.enemies.items[i]!;
    if (e.dead || e.flying) continue;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    if (dx * dx + dy * dy >= R2) continue;
    seenN++;
    if (w.rng() * seenN < 1) pick = e;
  }
  return pick;
}

/** El enemigo con más PV dentro de `range` (el rifle apunta al más duro). */
function toughestInRange(w: World, range: number): Enemy | null {
  const p = w.player;
  const R2 = range * range;
  let best: Enemy | null = null;
  for (let i = 0, n = w.enemies.count; i < n; i++) {
    const e = w.enemies.items[i]!;
    if (e.dead) continue;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    if (dx * dx + dy * dy >= R2) continue;
    if (!best || e.hp > best.hp) best = e;
  }
  return best;
}

const nearIdx = new Int32Array(16);
const nearD = new Float64Array(16);

/** Los `n` enemigos más cercanos dentro de `range` (índices en `nearIdx`). Devuelve cuántos. */
function nearestN(w: World, range: number, n: number): number {
  const p = w.player;
  const R2 = range * range;
  const cap = Math.min(n, nearIdx.length);
  let k = 0;
  for (let i = 0, c = w.enemies.count; i < c; i++) {
    const e = w.enemies.items[i]!;
    if (e.dead) continue;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = dx * dx + dy * dy;
    if (d >= R2) continue;
    if (k < cap) k++;
    else if (d >= nearD[k - 1]!) continue;
    // Inserción ordenada.
    let j = k - 1;
    while (j > 0 && nearD[j - 1]! > d) {
      nearD[j] = nearD[j - 1]!;
      nearIdx[j] = nearIdx[j - 1]!;
      j--;
    }
    nearD[j] = d;
    nearIdx[j] = i;
  }
  return k;
}

function fireOrbit(w: World, wp: Weapon, dt: number): void {
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

export function updateWeapon(w: World, wp: Weapon, dt: number): void {
  const p = w.player;
  const st = w.st;
  const out = w.qWeapon;
  const lvl = wp.lvl;
  switch (wp.id) {
    case 'llave':
    case 'dinamo':
      fireOrbit(w, wp, dt);
      return;
    case 'geiger': {
      const W = WEAPONS.geiger;
      wp.r = (W.r + W.rPerLvl * (lvl - 1) + W.rPerRad * p.rad) * st.area;
      wp.cd -= dt;
      if (wp.cd > 0) return;
      wp.cd = W.tickCd;
      pulseAura(w, wp, wp.r, scaled(W.dmg, W.dmgPerLvl, lvl));
      return;
    }
    case 'nucleo_inestable': {
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
    case 'petardos': {
      const W = WEAPONS.petardos;
      if (Number.isNaN(wp.lx)) {
        wp.lx = p.x;
        wp.ly = p.y;
      }
      const mx = p.x - wp.lx;
      const my = p.y - wp.ly;
      wp.dist += Math.sqrt(mx * mx + my * my);
      wp.lx = p.x;
      wp.ly = p.y;
      const step = Math.max(20, (W.step + W.stepPerLvl * (lvl - 1)) * st.cdMult);
      while (wp.dist >= step) {
        wp.dist -= step;
        if (w.mines.count >= W.maxMines) continue;
        const m = w.mines.acquire();
        m.x = p.x;
        m.y = p.y;
        m.t = W.fuse;
        m.r = (W.r + W.rPerLvl * (lvl - 1)) * st.area;
        m.dmg = scaled(W.dmg, W.dmgPerLvl, lvl);
      }
      return;
    }
  }

  wp.cd -= dt;
  if (wp.cd > 0) return;

  switch (wp.id) {
    case 'pistola_clavos':
    case 'remachadora': {
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
        addShot(
          w,
          base + (i - (n - 1) / 2) * W.spread,
          W.speed,
          4,
          W.range / W.speed,
          W.dmg,
          pierce,
          wp.id,
          0.5,
        );
      }
      wp.cd = (isPistol ? W.cd * Math.pow(WEAPONS.pistola_clavos.cdPerLvl, lvl - 1) : W.cd) * st.cdMult;
      return;
    }
    case 'jeringa':
    case 'dardos_incendiarios': {
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
    case 'escopeta_chatarra': {
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
    case 'rifle_cerrojo': {
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
    case 'coctel': {
      const W = WEAPONS.coctel;
      let thrown = 0;
      for (let i = 0; i < lvl; i++) {
        const t = randomInRange(w, W.range);
        if (!t) break;
        const l = w.lobs.acquire();
        l.sx = p.x;
        l.sy = p.y;
        l.tx = t.x;
        l.ty = t.y;
        l.t = 0;
        l.dur = W.flight;
        l.lvl = lvl;
        thrown++;
      }
      wp.cd = thrown === 0 ? 0.1 : W.cd * st.cdMult;
      return;
    }
    case 'tesla': {
      const W = WEAPONS.tesla;
      const t = nearest(w, p.x, p.y, W.range);
      if (!t) {
        wp.cd = 0.05;
        return;
      }
      chain(
        w,
        t,
        W.jumps + W.jumpsPerLvl * (lvl - 1),
        scaled(W.dmg, W.dmgPerLvl, lvl),
        'tesla',
        p.x,
        p.y,
        false,
      );
      wp.cd = W.cd * st.cdMult;
      return;
    }
    case 'martillo_pilon': {
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
      boom(w, p.x, p.y, R, 0.2, FX.colors.hammer);
      addShake(w, 2);
      wp.cd = W.cd * st.cdMult;
      return;
    }
    case 'megafono': {
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
      );
      beamPoint(beam, p.x, p.y);
      beamPoint(beam, p.x + Math.cos(base + half) * R, p.y + Math.sin(base + half) * R);
      wp.cd = W.cd * st.cdMult;
      return;
    }
    case 'desfibrilador': {
      const W = WEAPONS.desfibrilador;
      const k = nearestN(w, W.range, W.targets + lvl);
      if (k === 0) {
        wp.cd = 0.05;
        return;
      }
      const dmg = scaled(W.dmg, W.dmgPerLvl, lvl) * (1 + W.regenBonus * st.regen);
      for (let i = 0; i < k; i++) {
        const e = w.enemies.items[nearIdx[i]!]!;
        const beam = beamStart(w, p.x, p.y, 0.1, FX.colors.zap);
        beamPoint(beam, e.x, e.y);
        hitEnemy(w, e, dmg, wp.id, 0, W.kb, p.x, p.y);
      }
      wp.cd = W.cd * st.cdMult;
      return;
    }
    case 'nucleo_cobalto': {
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
  }
}

export function updateWeapons(w: World, dt: number): void {
  if (w.player.deadAt !== null) return;
  // El array puede cambiar solo al elegir tarjeta (con el motor parado), así que se recorre tal cual.
  for (let i = 0; i < w.weapons.length; i++) updateWeapon(w, w.weapons[i]!, dt);
}

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
    let done = s.life <= 0;
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
    addFirePool(
      w,
      l.tx,
      l.ty,
      W.poolR * w.st.area,
      life,
      scaled(W.dmg, W.dmgPerLvl, l.lvl),
      W.poolTick,
      'coctel',
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
    if (pl.tick <= 0) {
      pl.tick = pl.tickCd;
      const k = queryEnemies(w, pl.x, pl.y, pl.r, out);
      for (let q = 0; q < k; q++) {
        const e = w.enemies.items[out[q]!]!;
        if (!e.flying) hitEnemy(w, e, pl.dmg, pl.src, 0);
      }
    }
    if (pl.life <= 0) w.pools.releaseAt(i);
  }
}

export function updateMines(w: World, dt: number): void {
  const out = w.qWeapon;
  for (let i = w.mines.count - 1; i >= 0; i--) {
    const m = w.mines.items[i]!;
    m.t -= dt;
    if (m.t > 0) continue;
    const k = queryEnemies(w, m.x, m.y, m.r, out);
    for (let q = 0; q < k; q++) {
      const e = w.enemies.items[out[q]!]!;
      if (!e.flying) hitEnemy(w, e, m.dmg, 'petardos', 0, 1, m.x, m.y);
    }
    boom(w, m.x, m.y, m.r, 0.18, FX.colors.mine);
    w.mines.releaseAt(i);
  }
}
