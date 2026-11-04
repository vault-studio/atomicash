// Tirador especial (CAMBIOS §3): en vez de una zona, lanza una salva de impactos en línea por delante del jugador,
// siguiendo su dirección de movimiento. Cada impacto se marca en el suelo antes de caer, y caen uno tras otro: si no
// cambia de dirección, se los come todos. Contrarresta correr en línea recta. Cada impacto rompe el suelo y deja
// escombros (engine/scars.ts).
import { AI } from '../../config/enemies';
import { leadLine, type Vec } from '../rules';
import { markFall } from '../scars';
import type { Enemy, World } from '../types';

const pts: Vec[] = Array.from({ length: 16 }, () => ({ x: 0, y: 0 }));

/** Velocidad deseada que calcula `mortarThink` (sin reservar memoria). */
export const mortarVel: Vec = { x: 0, y: 0 };

/**
 * Coloca la salva: el impacto `i` cae a los `warn + i·stagger` s justo donde estaría el jugador si sigue igual. Quieto,
 * la salva cae en línea hacia donde mira, empezando en él. Devuelve cuántos impactos ha marcado.
 */
export function launchSalvo(w: World, src: number): number {
  const A = AI.mortero;
  const p = w.player;
  const sp = Math.hypot(p.vx, p.vy);
  const moving = sp > 1;
  const n = Math.min(A.shells, pts.length);
  const dirX = moving ? p.vx : p.facingX;
  const dirY = moving ? p.vy : p.facingY;
  const first = moving ? sp * A.warn : 0;
  const gap = moving ? Math.max(sp * A.stagger, A.minGap) : A.minGap;
  leadLine(p.x, p.y, dirX, dirY, first, gap, n, pts);
  for (let i = 0; i < n; i++) {
    markFall(w, pts[i]!.x, pts[i]!.y, A.shellR, A.warn + i * A.stagger, A.shellDmg, 0, src, 'shell');
  }
  return n;
}

/**
 * IA del mortero: se acerca hasta `hold` y se planta; cada `every` s, si el jugador está a menos de `range`, dispara
 * una salva. `e.timer` es su enfriamiento. Escribe la velocidad deseada en `mortarVel`.
 */
export function mortarThink(
  w: World,
  e: Enemy,
  d: number,
  ux: number,
  uy: number,
  spd: number,
  dt: number,
  src: number,
): boolean {
  const A = AI.mortero;
  if (d > A.hold) {
    mortarVel.x = ux * spd;
    mortarVel.y = uy * spd;
  } else {
    mortarVel.x = 0;
    mortarVel.y = 0;
  }
  e.timer -= dt;
  if (e.timer <= 0 && d < A.range) {
    e.timer = A.every;
    launchSalvo(w, src);
    return true;
  }
  return false;
}
