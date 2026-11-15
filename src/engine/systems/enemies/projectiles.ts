// Balas enemigas, avisos que caen (obuses, barriles, hielo) y rastros de babosa.
import { FX } from '../../../config/run';
import { RAINS } from '../../../config/modes';
import { addShake, boom } from '../../fx';
import { type World } from '../../types';
import { hitsObstacle } from '../../obstacles';
import { hurtIndex } from '../../runStats';
import { hurtPlayer } from '../combat';
import { landFall } from '../../scars';
import { spawnEnemy } from './spawn';

/** Fuentes de las salvas (mortero, bidonero y nevera): sus impactos cuentan como recibidos o esquivados. */
const MORTAR_SRC = hurtIndex('mortero');
const BARREL_SRC = hurtIndex('bidonero');
const FRIDGE_SRC = hurtIndex('nevera');

export function updateEnemyBullets(w: World, dt: number): void {
  const p = w.player;
  const pool = w.ebullets;
  for (let i = pool.count - 1; i >= 0; i--) {
    const b = pool.items[i]!;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || hitsObstacle(w, b.x, b.y)) {
      pool.releaseAt(i);
      continue;
    }
    const dx = b.x - p.x;
    const dy = b.y - p.y;
    const rr = p.r + b.r;
    if (dx * dx + dy * dy < rr * rr) {
      pool.releaseAt(i);
      hurtPlayer(w, b.dmg, b.rad, false, b.src);
    }
  }
}

export function updateTelegraphs(w: World, dt: number): void {
  const p = w.player;
  const pool = w.tele;
  for (let i = pool.count - 1; i >= 0; i--) {
    const t = pool.items[i]!;
    t.t += dt;
    if (t.t < t.dur) continue;
    const x = t.x;
    const y = t.y;
    const r = t.r;
    const dmg = t.dmg;
    const spawn = t.spawn;
    const src = t.src;
    const rad = t.rad;
    const fall = t.fall;
    const hz = t.hz;
    pool.releaseAt(i);
    if (dmg <= 0 && !spawn) continue;
    const c = FX.colors;
    if (fall === 'scrap') boom(w, x, y, r, RAINS.scrap.dustLife, c.debris);
    else
      boom(
        w,
        x,
        y,
        r,
        0.25,
        fall === 'acid' || fall === 'barrel' ? c.bloater : fall === 'ice' ? c.freeze : c.tele,
      );
    addShake(w, 3);
    const dx = p.x - x;
    const dy = p.y - y;
    const rr = r + p.r;
    const hit = dx * dx + dy * dy < rr * rr;
    if (hit) hurtPlayer(w, dmg, rad, false, src);
    if (fall) landFall(w, fall, x, y, hz);
    if (src === MORTAR_SRC || src === BARREL_SRC || src === FRIDGE_SRC) {
      if (hit) w.rs.shellsHit++;
      else w.rs.shellsDodged++;
    }
    if (spawn) spawnEnemy(w, spawn, x, y, false);
  }
}

export function updateSlimes(w: World, dt: number): void {
  for (let i = w.slimes.count - 1; i >= 0; i--) {
    const s = w.slimes.items[i]!;
    s.life -= dt;
    if (s.life <= 0) w.slimes.releaseAt(i);
  }
}
