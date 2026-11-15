// IA de cada enemigo según su tipo (`think`): despacha a roles, jefes y casos sencillos (copia, lanzadores,
// predicador, torreta, babosa). La velocidad deseada sale en `cur.vx`/`cur.vy`.
import { AI, ENEMY_STATS } from '../../../config/enemies';
import { IRRADIATED } from '../../../config/radiation';
import { SPAWN } from '../../../config/waves';
import { textFx } from '../../fx';
import { type Enemy, type Slime, type World } from '../../types';
import { hurtIndex } from '../../runStats';
import { mirrorAngle, mirrorBulletDmg, mirrorShotCount, mirrorThink, mirrorVel } from '../mirror';
import { mortarThink, mortarVel } from './shooters';
import { fireBullet, markAttack, speedOf } from './actions';
import { coloso, dirigible, reyRata } from './bosses';
import { dashTick } from './dash';
import { sermon } from './rage';
import { gunner, gunnerAI, interceptor, interceptorAI, salvoAI, salvoFall } from './roles';
import { cur, curSrc, setCurSrc } from './state';

/** Eslóganes de la torreta (i18n `slogans.<n>`). */
export const SLOGAN_COUNT = 6;

export function think(w: World, e: Enemy, dt: number): void {
  setCurSrc(hurtIndex(e.type));
  speedOf(w, e);
  const d = cur.d;
  const ux = cur.ux;
  const uy = cur.uy;
  const spd = cur.spd;
  const dash = ENEMY_STATS[e.type].dash;
  if (dash !== undefined && dashTick(w, e, dash, dt)) return;
  switch (e.type) {
    case 'interceptor':
    case 'sabueso':
    case 'motorista':
      interceptor(w, e, dt, interceptorAI(e.type));
      break;
    case 'tirador':
    case 'liquidador':
      gunner(w, e, dt, gunnerAI(e.type));
      break;
    case 'copia': {
      // Ráfaga en abanico hacia el jugador; el número de balas y su daño salen de mirror.ts.
      if (mirrorThink(w, e, d, ux, uy, dt)) {
        const n = mirrorShotCount(w);
        const dmg = mirrorBulletDmg(w);
        for (let i = 0; i < n; i++) {
          const a = mirrorAngle(i, n);
          const c = Math.cos(a);
          const s = Math.sin(a);
          fireBullet(w, e.x, e.y, ux * c - uy * s, ux * s + uy * c, AI.copia.bulletSpd, dmg, 0);
        }
        markAttack(w, e);
      }
      cur.vx = mirrorVel.x;
      cur.vy = mirrorVel.y;
      break;
    }
    case 'mortero':
    case 'bidonero':
    case 'nevera': {
      const A = salvoAI(e.type);
      if (mortarThink(w, e, cur, dt, curSrc, A, salvoFall(e.type))) markAttack(w, e);
      cur.vx = mortarVel.x;
      cur.vy = mortarVel.y;
      break;
    }
    case 'predicador': {
      const A = AI.predicador;
      if (d > A.keepMax) {
        cur.vx = ux * spd;
        cur.vy = uy * spd;
      } else if (d < A.keepMin) {
        cur.vx = -ux * spd;
        cur.vy = -uy * spd;
      } else {
        cur.vx = -uy * spd * A.strafe * e.side;
        cur.vy = ux * spd * A.strafe * e.side;
      }
      e.timer -= dt;
      if (e.timer <= 0 && d < A.range) {
        e.timer = A.every;
        sermon(w, e);
        markAttack(w, e);
      }
      break;
    }
    case 'rey_rata':
      reyRata(w, e, dt);
      break;
    case 'torreta': {
      const A = AI.torreta;
      cur.vx = cur.vy = 0;
      e.timer -= dt;
      if (e.burst > 0) {
        e.bt -= dt;
        if (e.bt <= 0) {
          e.burst--;
          e.bt = A.burstGap;
          fireBullet(w, e.x, e.y, ux, uy, A.bulletSpd, e.dmg, e.irr ? IRRADIATED.rad : 0);
        }
      } else if (e.timer <= 0 && d < A.range) {
        e.timer = A.every;
        e.burst = A.burst;
        e.bt = 0;
        markAttack(w, e);
        if (w.rng() < A.sloganChance) textFx(w, 'slogan', e.x, e.y, (w.rng() * SLOGAN_COUNT) | 0);
      }
      e.facingX = ux;
      e.facingY = uy;
      break;
    }
    case 'babosa': {
      const A = AI.babosa;
      cur.vx = ux * spd;
      cur.vy = uy * spd;
      e.trail -= dt;
      if (e.trail <= 0) {
        e.trail = A.trailEvery;
        let s: Slime;
        if (w.slimes.count < SPAWN.maxSlime) s = w.slimes.acquire();
        else {
          // Lleno: reemplaza el rastro con menos vida.
          let oi = 0;
          for (let i = 1; i < w.slimes.count; i++)
            if (w.slimes.items[i]!.life < w.slimes.items[oi]!.life) oi = i;
          s = w.slimes.items[oi]!;
        }
        s.x = e.x;
        s.y = e.y;
        s.r = A.trailR;
        s.life = s.max = A.trailLife;
        s.rad = A.trailRad;
      }
      break;
    }
    case 'dirigible':
      dirigible(w, e, dt);
      break;
    case 'coloso':
      coloso(w, e, dt);
      break;
    default:
      cur.vx = ux * spd;
      cur.vy = uy * spd;
  }
}
