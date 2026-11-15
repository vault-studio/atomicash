// Bucle principal de enemigos: movimiento, contacto, separación y efectos de élite.
// No usar Math.hypot en el bucle caliente (V8 reserva memoria en cada llamada): `hypot2` da lo mismo sin reservar.
// Ni pasar decimales como argumentos a funciones del bucle: van en `cur` y `body`.
import { ELITES, ENEMY_RULES, ENEMY_STATS, MAX_ENEMY_RADIUS, type EnemyStats } from '../../../config/enemies';
import { IRRADIATED } from '../../../config/radiation';
import { KNOCKBACK, PLAYER } from '../../../config/run';
import { MODE_AIM, MODE_CHASE, type Enemy, type World } from '../../types';
import { blockBody, body } from '../../obstacles';
import { hurtIndex } from '../../runStats';
import { addRad, hurtPlayer } from '../combat';
import { markAttack, speedOf } from './actions';
import { rageTick } from './rage';
import { cur } from './state';
import { think } from './think';

/** Lo que hace cada prefijo de élite en cada tick (el blindaje y la división van en combat.ts). */
function eliteTick(w: World, e: Enemy, d: number, dt: number): void {
  if (e.elite === 'radiactivo') {
    if (d < ELITES.radiactivo.auraR) addRad(w, ELITES.radiactivo.auraRad * dt);
  } else if (e.elite === 'vampirico') {
    e.hp = Math.min(e.maxHp, e.hp + e.maxHp * ELITES.vampirico.regen * dt);
  }
}

export function updateEnemies(w: World, dt: number): void {
  const pool = w.enemies;
  const items = pool.items;
  const n = pool.count;
  const p = w.player;
  const grid = w.enemyGrid;
  const out = w.scratch;
  const kd = Math.exp(-KNOCKBACK.decay * dt);
  const alive = p.deadAt === null;

  for (let i = 0; i < n; i++) {
    const e = items[i] as Enemy;
    if (e.dead) continue;
    e.prevX = e.x;
    e.prevY = e.y;
    e.flash -= dt;
    e.atkCd -= dt;
    // Congelado por la crio-granada: ni se mueve ni ataca (ni cuenta su furia).
    if (e.frozen > 0) {
      e.frozen -= dt;
      e.moving = false;
      continue;
    }
    if (!e.boss && !e.elite) rageTick(w, e, dt);
    if (e.slowT > 0) {
      e.slowT -= dt;
      if (e.slowT <= 0) e.slowK = 1;
    }

    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / d;
    const uy = dy / d;
    let vx = 0;
    let vy = 0;
    if (e.march > 0) {
      // Horda en formación: sigue recto aunque el jugador se aparte.
      e.march -= dt;
      speedOf(w, e);
      vx = e.dx * cur.spd;
      vy = e.dy * cur.spd;
    } else if (!e.boss && e.stun > 0) {
      // Aturdido por los petardos: no avanza ni ataca, pero el empuje sigue.
      e.stun -= dt;
    } else if (alive) {
      cur.d = d;
      cur.ux = ux;
      cur.uy = uy;
      cur.vx = 0;
      cur.vy = 0;
      think(w, e, dt);
      vx = cur.vx;
      vy = cur.vy;
    }
    if (e.elite && alive) eliteTick(w, e, d, dt);
    if (e.irr && alive && d < IRRADIATED.auraR) addRad(w, IRRADIATED.auraRad * dt);
    // Si ya está encima del jugador, no lo empuja (solo se separa).
    // El Coloso en pleno salto (alt) no se para encima del jugador ni rodea obstáculos: va por el aire.
    if (
      e.mode === MODE_CHASE &&
      e.march <= 0 &&
      d <= e.r + p.r &&
      e.type !== 'dirigible' &&
      e.type !== 'copia' && // Nace encima del jugador y tiene que poder apartarse.
      !(e.type === 'coloso' && e.alt)
    ) {
      vx = 0;
      vy = 0;
    }

    // Separación con los vecinos solapados (no aplica a jefes, voladores ni torretas).
    let sx = 0;
    let sy = 0;
    if (!e.boss && !e.flying && e.type !== 'torreta') {
      const k = grid.queryCircle(e, MAX_ENEMY_RADIUS, out);
      for (let j = 0; j < k && j < ENEMY_RULES.maxNeighbors; j++) {
        const oi = out[j]!;
        if (oi === i) continue;
        const o = items[oi] as Enemy;
        if (o.flying || o.dead) continue;
        let ox = e.x - o.x;
        let oy = e.y - o.y;
        let od = Math.sqrt(ox * ox + oy * oy);
        if (od < 1e-6) {
          // Centros coincidentes: separa en una dirección determinista según el orden en el pool.
          ox = i < oi ? 1 : -1;
          oy = 0;
          od = 1;
        }
        const overlap = e.r + o.r - od;
        if (overlap > 0) {
          const push =
            Math.min(overlap, ENEMY_RULES.separationMaxPush) * (o.boss ? 1 : ENEMY_RULES.separationShare);
          sx += (ox / od) * push;
          sy += (oy / od) * push;
        }
      }
    }

    const nx = e.x + (vx + e.kbx) * dt + sx;
    const ny = e.y + (vy + e.kby) * dt + sy;
    e.x = nx;
    e.y = ny;
    // Los de tierra rodean los obstáculos; los voladores pasan por encima.
    if (!e.flying && !(e.type === 'coloso' && e.alt) && e.type !== 'torreta' && e.type !== 'dirigible') {
      body.r = e.r;
      body.vx = vx + e.kbx;
      body.vy = vy + e.kby;
      body.side = e.side;
      blockBody(w, e);
    }
    e.kbx *= kd;
    e.kby *= kd;

    // Orientación para el sprite.
    const vl = Math.sqrt(vx * vx + vy * vy);
    e.moving = vl > ENEMY_RULES.movingSpeed;
    if (e.mode === MODE_AIM) {
      e.facingX = e.dx;
      e.facingY = e.dy;
    } else if (e.type !== 'torreta') {
      if (e.moving) {
        e.facingX = vx / vl;
        e.facingY = vy / vl;
      } else {
        e.facingX = ux;
        e.facingY = uy;
      }
    }

    // Contacto.
    if (alive && !e.flying && e.dmg > 0 && e.type !== 'torreta' && d < p.r + e.r && e.atkCd <= 0) {
      const s: EnemyStats = ENEMY_STATS[e.type];
      const r = hurtPlayer(w, e.dmg, (s.rad ?? 0) + (e.irr ? IRRADIATED.rad : 0), false, hurtIndex(e.type));
      if (r !== 0) {
        e.atkCd = PLAYER.contactCd;
        if (!e.boss) markAttack(w, e);
        if (r > 0 && e.elite === 'vampirico')
          e.hp = Math.min(e.maxHp, e.hp + e.maxHp * ELITES.vampirico.healOnHit);
      }
    }
  }
}
