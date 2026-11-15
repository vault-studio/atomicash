import type { StatSurvivorId } from '../../config/survivors';

/** Entrada ya convertida a coordenadas de mundo. Magnitud ≤ 1. */
export interface InputState {
  moveX: number;
  moveY: number;
}

/** Stats derivados del jugador; se recalculan cada tick sin crear objetos (`recalc`). */
export interface PlayerStats {
  maxHp: number;
  speed: number;
  magnet: number;
  armor: number;
  luck: number;
  dmgMult: number;
  cdMult: number;
  regen: number;
  xpMult: number;
  red: number;
  dodge: number;
  crit: number;
  /** Multiplicador del daño crítico (CAPS.critMult + el rasgo). */
  critMult: number;
  area: number;
  pierce: number;
  kb: number;
  radGain: number;
  radDecayBonus: number;
  meleeMult: number;
  bossMult: number;
  /** Daño del arma inicial (y de su fusión), por el árbol del personaje. */
  starterMult: number;
}

export interface Player {
  readonly charId: StatSurvivorId;
  x: number;
  y: number;
  /** Posición del paso anterior, para interpolar el render. */
  prevX: number;
  prevY: number;
  readonly r: number;
  hp: number;
  maxHp: number;
  /** Última dirección de movimiento (unitaria), para elegir la fila del sprite. */
  facingX: number;
  facingY: number;
  moving: boolean;
  /** Tiempo de la run en que murió; null si sigue vivo. */
  deadAt: number | null;
  /** Invulnerabilidad restante, en s. */
  inv: number;
  /** Radiación 0–100. */
  rad: number;
  radPeak: number;
  /** Batido turbo restante, en s. */
  turbo: number;
  /** Nuka-pila restante (cadencia doble), en s. */
  nuka: number;
  /** Segundos que quedan de botas de velocidad. */
  boots: number;
  /** Curación por bajas disponible (tope por segundo). */
  healBudget: number;
  /** Tiempo de la run del último golpe recibido. */
  lastHit: number;
  /** Depuración: no recibe daño. */
  god: boolean;
  /** Velocidad real del último tick, en px/s (la usan los enemigos que predicen hacia dónde va). */
  vx: number;
  vy: number;
  /** Aturdido (no se mueve; el autoataque sigue) y su inmunidad posterior restante, en s. */
  stun: number;
  stunImmune: number;
  /** Segundos que quedan de la carrera tras esquivar (mod `dodgeRush`). */
  rush: number;
  /** Ya usó el salvavidas de RAD máxima (mod `radSave`, una vez por partida). */
  radSaved: boolean;
}
