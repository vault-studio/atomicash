// Acciones comunes de la IA: marcar ataque, disparar, avisos en el suelo, salto del Coloso, anillos de invocación
// y velocidad efectiva (`speedOf`).
import { AI, ENEMY_RULES, ENEMY_STATS, RAGE, type StatEnemyId } from '../../../config/enemies';
import { addShake } from '../../fx';
import { type AttackAnim, type Enemy, type World } from '../../types';
import { SFX, sfx } from '../../sfx';
import { spawnEnemy } from './spawn';
import { TAU, cur, curSrc } from './state';

export function markAttack(w: World, e: Enemy, anim: AttackAnim = 'attack'): void {
  e.lastAtk = w.time;
  e.atkAnim = anim;
}

export function fireBullet(
  w: World,
  x: number,
  y: number,
  ux: number,
  uy: number,
  spd: number,
  dmg: number,
  rad: number,
): void {
  sfx(w, SFX.eshot, x, y);
  const b = w.ebullets.acquire();
  b.x = x;
  b.y = y;
  b.vx = ux * spd;
  b.vy = uy * spd;
  b.r = ENEMY_RULES.bulletR;
  b.dmg = dmg;
  b.rad = rad;
  b.src = curSrc;
  b.life = ENEMY_RULES.bulletLife;
}

export function telegraph(
  w: World,
  x: number,
  y: number,
  r: number,
  dur: number,
  dmg: number,
  spawn: StatEnemyId | null = null,
  lx = 0,
  ly = 0,
): void {
  const t = w.tele.acquire();
  t.x = x;
  t.y = y;
  t.r = r;
  t.lx = lx;
  t.ly = ly;
  t.t = 0;
  t.dur = dur;
  t.dmg = dmg;
  t.spawn = spawn;
  t.src = curSrc;
  t.rad = 0;
  t.fall = null;
  t.hz = 0;
}

/** Salto del Coloso: aviso donde está ahora el jugador y velocidad para llegar justo al acabar el aviso. */
export function startLeap(w: World, e: Enemy): void {
  const A = AI.coloso;
  const p = w.player;
  telegraph(w, p.x, p.y, A.stompR, A.stompWarn, A.stompDmg);
  e.dx = (p.x - e.x) / A.stompWarn;
  e.dy = (p.y - e.y) / A.stompWarn;
  e.stun = A.stompWarn;
  e.alt = true;
}

export function leapTick(w: World, e: Enemy, dt: number): void {
  e.stun -= dt;
  if (e.stun <= 0 && e.alt) {
    e.alt = false;
    addShake(w, 12, 16);
  }
}

export function ring(w: World, type: StatEnemyId, cx: number, cy: number, n: number, dist: number): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    spawnEnemy(w, type, cx + Math.cos(a) * dist, cy + Math.sin(a) * dist, false);
  }
}

/** Calcula `cur.spd`: un enfurecido corre a max(la suya, la del jugador × `RAGE.speed`), así que puede alcanzarlo. */
export function speedOf(w: World, e: Enemy): void {
  if (!e.rage) {
    cur.spd = e.speed * e.slowK;
    return;
  }
  // Inline (sin llamar a rageSpeed): este es el camino caliente y las llamadas con decimales reservan memoria.
  const ovr = ENEMY_STATS[e.type].rage;
  const run = w.st.speed * (ovr !== undefined && ovr.speed !== undefined ? ovr.speed : RAGE.speed);
  cur.spd = (run > e.speed ? run : e.speed) * e.slowK;
}
