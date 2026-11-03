// Reglas puras de combate y movimiento (CAMBIOS §1, §2, §5): sin mundo ni estado global, para testearlas aisladas.

/**
 * Blindaje plano: resta `armor` a cada impacto, menos lo que atraviese el arma (`pierce`). Nunca baja de `minFrac` del
 * golpe, para que ningún enemigo sea inmune. Así las armas de muchos golpes pequeños rinden mal contra blindados y
 * las de golpe fuerte bien.
 */
export function applyArmor(dmg: number, armor: number, pierce: number, minFrac: number): number {
  if (dmg <= 0) return 0;
  const eff = armor - pierce;
  if (eff <= 0) return dmg;
  return Math.max(dmg * minFrac, dmg - eff);
}

/** Estado de aturdimiento del jugador: tiempo restante y de inmunidad a otro aturdimiento, en s. */
export interface StunState {
  stun: number;
  stunImmune: number;
}

/**
 * Intenta aturdir: falla si ya está aturdido o es inmune. Si aturde, la inmunidad empieza a contar al acabar el
 * aturdimiento, para que no se encadenen.
 */
export function tryStun(s: StunState, dur: number, immunity: number): boolean {
  if (s.stun > 0 || s.stunImmune > 0) return false;
  s.stun = dur;
  s.stunImmune = dur + immunity;
  return true;
}

export function tickStun(s: StunState, dt: number): void {
  if (s.stun > 0) s.stun = Math.max(0, s.stun - dt);
  if (s.stunImmune > 0) s.stunImmune = Math.max(0, s.stunImmune - dt);
}

/** ¿Cabe otro de este tipo? `cap` ≤ 0 = sin límite. */
export const underCap = (alive: number, cap: number | undefined): boolean => !cap || cap <= 0 || alive < cap;

export interface Vec {
  x: number;
  y: number;
}

/**
 * Punto de interceptación: dónde estará el objetivo (posición `p`, velocidad `v`) cuando llegue un perseguidor desde
 * `e` a velocidad `spd`. Recibe números sueltos para no reservar memoria en el bucle de IA. Resuelve |p + v·t − e| = spd·t y limita t a `maxLead` s. Si no hay solución (el objetivo es
 * más rápido y se aleja), usa `maxLead`. Escribe en `out` y devuelve t.
 */
export function interceptPoint(
  ex: number,
  ey: number,
  px: number,
  py: number,
  vx: number,
  vy: number,
  spd: number,
  maxLead: number,
  out: Vec,
): number {
  const rx = px - ex;
  const ry = py - ey;
  const a = vx * vx + vy * vy - spd * spd;
  const b = 2 * (rx * vx + ry * vy);
  const c = rx * rx + ry * ry;
  let t = maxLead;
  if (Math.abs(a) < 1e-9) {
    if (b < 0) t = -c / b;
  } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const sq = Math.sqrt(disc);
      const t1 = (-b - sq) / (2 * a);
      const t2 = (-b + sq) / (2 * a);
      const lo = Math.min(t1, t2);
      const hi = Math.max(t1, t2);
      t = lo > 0 ? lo : hi > 0 ? hi : maxLead;
    }
  }
  if (!(t <= maxLead)) t = maxLead;
  out.x = px + vx * t;
  out.y = py + vy * t;
  return t;
}

/** Gira el rumbo `(hx, hy)` hacia `(tx, ty)` como mucho `maxTurn` radianes. Ambos unitarios; escribe en `out`. */
export function turnToward(hx: number, hy: number, tx: number, ty: number, maxTurn: number, out: Vec): void {
  const cur = Math.atan2(hy, hx);
  let diff = Math.atan2(ty, tx) - cur;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  const a = cur + Math.max(-maxTurn, Math.min(maxTurn, diff));
  out.x = Math.cos(a);
  out.y = Math.sin(a);
}

/**
 * Impactos de una salva por delante del jugador, en la línea de su movimiento: el primero a `first` px y los demás
 * cada `gap` px. Si está quieto, usa `fx, fy` (hacia donde mira). Escribe hasta `n` puntos en `out`.
 */
export function leadLine(
  px: number,
  py: number,
  dirX: number,
  dirY: number,
  first: number,
  gap: number,
  n: number,
  out: Vec[],
): void {
  const l = Math.hypot(dirX, dirY) || 1;
  const ux = dirX / l;
  const uy = dirY / l;
  for (let i = 0; i < n && i < out.length; i++) {
    const d = first + gap * i;
    out[i]!.x = px + ux * d;
    out[i]!.y = py + uy * d;
  }
}
