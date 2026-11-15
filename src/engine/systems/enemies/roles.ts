// IA por rol: interceptores (interceptor, sabueso, motorista), tiradores y bloques de IA de los lanzadores.
import {
  AI,
  type GunnerAI,
  type InterceptorAI,
  type SalvoAI,
  type StatEnemyId,
} from '../../../config/enemies';
import { IRRADIATED, RAD } from '../../../config/radiation';
import { MODE_AIM, MODE_CHASE, MODE_DASH, type Enemy, type TeleFall, type World } from '../../types';
import { houndSpeed, hypot2, interceptPoint, skidVelocity, tryStun, turnToward, type Vec } from '../../rules';
import { hurtPlayer } from '../combat';
import { fireBullet, markAttack } from './actions';
import { aimPt } from './dash';
import { cur, curSrc } from './state';

// Bloques de IA según el tipo. Son funciones aparte, y `think` llama a cada habilidad desde un solo sitio: si tuviera
// una llamada por tipo, gastaría el presupuesto de inlining de V8 y sus ayudantes serían llamadas de verdad.

/** Bloque de IA de los interceptores: `ai.sabueso`, `ai.motorista` o, en cualquier otro caso, `ai.interceptor`. */
export function interceptorAI(type: StatEnemyId): InterceptorAI {
  return type === 'sabueso' ? AI.sabueso : type === 'motorista' ? AI.motorista : AI.interceptor;
}

/** Bloque de IA de los tiradores de balas: `ai.liquidador` o, en cualquier otro caso, `ai.tirador`. */
export const gunnerAI = (type: StatEnemyId): GunnerAI => (type === 'liquidador' ? AI.liquidador : AI.tirador);

/** Bloque de IA de los lanzadores: `ai.bidonero`, `ai.nevera` o, en cualquier otro caso, `ai.mortero`. */
export function salvoAI(type: StatEnemyId): SalvoAI {
  return type === 'bidonero' ? AI.bidonero : type === 'nevera' ? AI.nevera : AI.mortero;
}

/** Lo que cae de cada lanzador: barriles de ácido, bloques de hielo u obuses. */
export const salvoFall = (type: StatEnemyId): TeleFall =>
  type === 'bidonero' ? 'barrel' : type === 'nevera' ? 'ice' : 'shell';
const head: Vec = { x: 0, y: 0 };

/**
 * Interceptor (CAMBIOS §2): corre mucho más que el jugador pero gira despacio, y apunta a donde va a estar (le corta
 * la ruta de salida). `mt` = segundos que lleva de carrera; si alcanza al jugador tras `stunCharge` s, lo aturde.
 * Al alcanzarlo o pasar de largo (esquivado) frena `recover` s y vuelve a empezar la carrera. `A` es su bloque de IA
 * (`ai.interceptor`, `ai.sabueso`, `ai.motorista`). Con `skidSpeed` (motorista), si falla no frena de cara al jugador:
 * derrapa (MODE_DASH) `recover` s recto, expuesto (daño × `exposedMult`), y luego da la vuelta y carga otra vez.
 */
export function interceptor(w: World, e: Enemy, dt: number, A: InterceptorAI): void {
  const p = w.player;
  const d = cur.d;
  const ux = cur.ux;
  const uy = cur.uy;
  const base = cur.spd;
  if (e.dx === 0 && e.dy === 0) {
    e.dx = ux;
    e.dy = uy;
  }
  if (e.mode === MODE_DASH) {
    // Derrape del motorista (`e.timer` = lo que le queda): sigue su rumbo, sin girar hacia el jugador, y va frenando.
    const k = skidVelocity(base, A.skidSpeed ?? 0, e.timer, A.recover);
    cur.vx = e.dx * k;
    cur.vy = e.dy * k;
    e.timer -= dt;
    if (e.timer <= 0) {
      e.mode = MODE_CHASE;
      e.mt = 0;
      e.alt = false;
    }
    return;
  }
  // El sabueso corre más cuanta más RAD lleva el jugador.
  const spd = A.radSpeed === undefined ? base : houndSpeed(base, A.radSpeed, p.rad, RAD.max);
  interceptPoint(e.x, e.y, p.x, p.y, p.vx, p.vy, spd, A.lead, aimPt);
  const tx = aimPt.x - e.x;
  const ty = aimPt.y - e.y;
  const tl = hypot2(tx, ty) || 1;
  turnToward(e.dx, e.dy, tx / tl, ty / tl, A.turn * dt, head);
  e.dx = head.x;
  e.dy = head.y;
  if (e.mode === MODE_AIM) {
    // Frenando tras una carrera.
    cur.vx = e.dx * spd * A.recoverSpeed;
    cur.vy = e.dy * spd * A.recoverSpeed;
    e.timer -= dt;
    if (e.timer <= 0) {
      e.mode = MODE_CHASE;
      e.mt = 0;
      e.alt = false;
    }
    return;
  }
  cur.vx = e.dx * spd;
  cur.vy = e.dy * spd;
  e.mt += dt;
  if (d < p.r + e.r) {
    w.rs.chargesHit++;
    if (e.atkCd <= 0) hurtPlayer(w, e.dmg, 0, false, curSrc);
    if (e.mt >= A.stunCharge && tryStun(p, A.stunDur, A.stunImmunity)) w.rs.stuns++;
    e.mode = MODE_AIM;
    e.timer = A.recover;
    // Frenando no pega: el daño es el del choque de la carrera.
    e.atkCd = Math.max(e.atkCd, A.recover);
    markAttack(w, e);
  } else if (d < A.missR) e.alt = true;
  else if (e.alt && e.dx * ux + e.dy * uy < 0) {
    // Pasó rozando y ya se aleja: esquivado.
    w.rs.chargesDodged++;
    e.timer = A.recover;
    if (A.skidSpeed === undefined) e.mode = MODE_AIM;
    else {
      // Fallo del motorista: derrapa.
      e.mode = MODE_DASH;
      markAttack(w, e);
    }
  }
}

/**
 * Tirador de balas (`ai.tirador`, `ai.liquidador`): se acerca hasta `hold`, se planta y dispara cada `fireCd` s. Cada
 * bala suma `shotRad` de RAD al jugador (más los del irradiado).
 */
export function gunner(w: World, e: Enemy, dt: number, A: GunnerAI): void {
  const d = cur.d;
  if (d > (e.moving ? A.hold : A.hold + A.resume)) {
    cur.vx = cur.ux * cur.spd;
    cur.vy = cur.uy * cur.spd;
  } else {
    cur.vx = 0;
    cur.vy = 0;
  }
  e.timer -= dt;
  if (e.timer <= 0 && d < A.range) {
    e.timer = A.fireCd;
    const irrRad = e.irr ? IRRADIATED.rad : 0;
    fireBullet(w, e.x, e.y, cur.ux, cur.uy, A.bulletSpd, e.dmg, irrRad + (A.shotRad ?? 0));
    markAttack(w, e);
  }
}
