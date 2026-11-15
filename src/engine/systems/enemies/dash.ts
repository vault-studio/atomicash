// Embestidas: pasillo marcado, fin de carrera, interrupción y embestida por datos (`enemies.<id>.dash`).
import { ENEMY_STATS, type DashSpec, type EnemyStats } from '../../../config/enemies';
import { MODE_AIM, MODE_CHASE, MODE_DASH, type Enemy, type World } from '../../types';
import { interceptPoint, type Vec } from '../../rules';
import { markAttack, telegraph } from './actions';
import { interceptorAI, salvoAI } from './roles';
import { cur } from './state';

/** Marca en el suelo el pasillo de una embestida (solo aviso: el daño lo hace el contacto). */
export function dashLane(w: World, e: Enemy, aim: number, len: number): void {
  const l = len + e.r;
  telegraph(w, e.x, e.y, e.r, aim, 0, null, e.dx * l, e.dy * l);
}

/** Distancia (px) hasta el jugador medida sobre el pasillo de la embestida (`dx`, `dy`); negativa si ya lo ha pasado. */
function alongLane(w: World, e: Enemy): number {
  return (w.player.x - e.x) * e.dx + (w.player.y - e.y) * e.dy;
}

/**
 * La embestida nunca se queda corta: sigue en línea recta hasta dejar al jugador `over` px atrás. Solo acaba antes si
 * él corre por el pasillo más deprisa que ella (`spd`), porque entonces no lo alcanzaría nunca.
 */
export function dashDone(w: World, e: Enemy, spd: number, over: number): boolean {
  const p = w.player;
  return alongLane(w, e) + over <= 0 || p.vx * e.dx + p.vy * e.dy >= spd;
}

/**
 * Interrumpe la habilidad que esté preparando o lanzando (CAMBIOS §5, control): la embestida vuelve a perseguir con su
 * enfriamiento entero, el interceptor corta su carrera y el mortero reinicia la carga. Los jefes no se interrumpen.
 */
export function interruptEnemy(e: Enemy): boolean {
  if (e.boss) return false;
  const dash = ENEMY_STATS[e.type].dash;
  if (dash !== undefined && e.mode !== MODE_CHASE) {
    e.mode = MODE_CHASE;
    e.timer = dash.every;
    return true;
  }
  const role = (ENEMY_STATS[e.type] as EnemyStats).role;
  if (role === 'interceptor' && e.mode === MODE_CHASE) {
    // Corta la carrera: frena y pierde lo acumulado para aturdir.
    e.mode = MODE_AIM;
    e.timer = interceptorAI(e.type).recover;
    e.mt = 0;
    e.alt = false;
    return true;
  }
  if (role === 'launcher') {
    const every = salvoAI(e.type).every;
    if (e.timer < every) {
      e.timer = every;
      return true;
    }
  }
  return false;
}

export const aimPt: Vec = { x: 0, y: 0 };

/**
 * Embestida por datos (CAMBIOS §1, `enemies.<id>.dash`): vale para cualquier tipo. Cada `every` s, si el jugador está a
 * menos de `range`, se para `aim` s con el pasillo marcado en el suelo y corre a `speed` hasta dejar atrás al jugador
 * (`dashDone`; como mucho `maxDur` s, que `mt` cuenta). La dirección se fija al empezar el aviso: hacia el jugador (`lead` 0) o hacia donde va a estar
 * (`interceptPoint`, hasta `lead` s). Pone `cur.vx`/`cur.vy` y devuelve true mientras apunta o embiste; si no, devuelve false
 * y manda la IA normal del tipo.
 */
export function dashTick(w: World, e: Enemy, D: DashSpec, dt: number): boolean {
  if (e.mode === MODE_CHASE) {
    e.timer -= dt;
    const d = cur.d;
    if (e.timer > 0 || d >= D.range) return false;
    e.mode = MODE_AIM;
    e.mt = D.aim;
    e.dx = cur.ux;
    e.dy = cur.uy;
    let reach = d;
    if (D.lead > 0) {
      const p = w.player;
      interceptPoint(e.x, e.y, p.x, p.y, p.vx, p.vy, D.speed, D.lead, aimPt);
      const tx = aimPt.x - e.x;
      const ty = aimPt.y - e.y;
      const tl = Math.sqrt(tx * tx + ty * ty);
      if (tl > 1e-6) {
        e.dx = tx / tl;
        e.dy = ty / tl;
        reach = tl;
      }
    }
    // El pasillo marca hasta el jugador o el punto apuntado (el más lejano) y `over` más; la carrera real lo sigue.
    const along = alongLane(w, e);
    dashLane(w, e, D.aim, (along > reach ? along : reach) + D.over);
    markAttack(w, e);
    cur.vx = cur.vy = 0;
    return true;
  }
  if (e.mode === MODE_AIM) {
    cur.vx = cur.vy = 0;
    e.mt -= dt;
    if (e.mt <= 0) {
      e.mode = MODE_DASH;
      e.mt = D.maxDur;
    }
    return true;
  }
  cur.vx = e.dx * D.speed;
  cur.vy = e.dy * D.speed;
  e.mt -= dt;
  if (e.mt <= 0 || dashDone(w, e, D.speed, D.over)) {
    e.mode = MODE_CHASE;
    e.mt = 0;
    e.timer = D.every;
  }
  return true;
}
