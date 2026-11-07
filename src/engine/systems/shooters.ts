// Tirador especial (CAMBIOS §3): en vez de una zona, lanza una salva de impactos en línea por delante del jugador,
// siguiendo su dirección de movimiento. Cada impacto se marca en el suelo antes de caer, y caen uno tras otro: si no
// cambia de dirección, se los come todos. Contrarresta correr en línea recta. Cada impacto rompe el suelo y deja
// escombros (engine/scars.ts). El bidonero y la nevera usan la misma salva con su propio bloque de IA y otro tipo de
// caída: lagos de ácido y manchas de hielo.
import { AI, type SalvoAI } from '../../config/enemies';
import { leadLine, type Vec } from '../rules';
import { markFall } from '../scars';
import type { Enemy, TeleFall, World } from '../types';

const pts: Vec[] = Array.from({ length: 16 }, () => ({ x: 0, y: 0 }));

/** Lo que `mortarThink` necesita saber del lanzador: distancia y dirección al jugador y velocidad efectiva. */
export interface Steer {
  d: number;
  ux: number;
  uy: number;
  spd: number;
}

/** Velocidad deseada que calcula `mortarThink` (sin reservar memoria). */
export const mortarVel: Vec = { x: 0, y: 0 };

/**
 * Coloca la salva: el impacto `i` cae a los `warn + i·stagger` s justo donde estaría el jugador si sigue igual. Quieto,
 * la salva cae en línea hacia donde mira, empezando en él. Devuelve cuántos impactos ha marcado. `A` es el bloque de IA
 * del lanzador y `fall` lo que cae (`hz`: radio del lago si deja uno).
 */
export function launchSalvo(
  w: World,
  src: number,
  A: SalvoAI = AI.mortero,
  fall: TeleFall = 'shell',
  hz = 0,
): number {
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
    markFall(w, pts[i]!.x, pts[i]!.y, A.shellR, A.warn + i * A.stagger, A.shellDmg, 0, src, fall, hz);
  }
  return n;
}

/**
 * IA del mortero (y de los lanzadores con su bloque `A`): se acerca hasta `hold` y se planta; cada `every` s, si el
 * jugador está a menos de `range`, dispara una salva. `e.timer` es su enfriamiento. Escribe la velocidad deseada en
 * `mortarVel`. Los decimales llegan en `s`, no en argumentos: el bucle de IA no debe reservar memoria.
 */
export function mortarThink(
  w: World,
  e: Enemy,
  s: Steer,
  dt: number,
  src: number,
  A: SalvoAI,
  fall: TeleFall,
): boolean {
  const d = s.d;
  if (d > A.hold) {
    mortarVel.x = s.ux * s.spd;
    mortarVel.y = s.uy * s.spd;
  } else {
    mortarVel.x = 0;
    mortarVel.y = 0;
  }
  e.timer -= dt;
  if (e.timer <= 0 && d < A.range) {
    e.timer = A.every;
    launchSalvo(w, src, A, fall, A.lake ?? 0);
    return true;
  }
  return false;
}
