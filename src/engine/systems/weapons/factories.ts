// Objetos de los pools de armas (disparo, botella, charco, petardo, arma) y altas de disparos y charcos.
import { type WeaponId } from '../../../config/weapons';
import { SFX, SHOT_SFX, sfx } from '../../sfx';
import {
  SHOT_HITS,
  type FirePool,
  type Lob,
  type Mine,
  type Shot,
  type Weapon,
  type World,
} from '../../types';

export const TAU = Math.PI * 2;

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
  burn: 0,
  src: 'coctel',
});
export const createMine = (): Mine => ({ x: 0, y: 0, sx: 0, sy: 0, fly: 0, flyDur: 0, t: 0, r: 0, dmg: 0 });

export function createWeapon(id: WeaponId, lvl = 1, got = 0): Weapon {
  return { id, lvl, cd: 0.3, a: 0, r: 0, cd2: 0, got };
}

export function addShot(
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
  sfx(w, SHOT_SFX[src] ?? SFX.shot);
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

export function addFirePool(
  w: World,
  x: number,
  y: number,
  r: number,
  life: number,
  dmg: number,
  tickCd: number,
  src: WeaponId,
  burn = 0,
): void {
  const pl = w.pools.acquire();
  pl.x = x;
  pl.y = y;
  pl.r = r;
  pl.life = pl.max = life;
  pl.tick = 0;
  pl.tickCd = tickCd;
  pl.dmg = dmg;
  pl.burn = burn;
  pl.src = src;
}
