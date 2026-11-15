// Estado compartido de la IA de enemigos durante un tick: `cur` (decimales del enemigo que actúa) y `curSrc`.
// Sin allocations: no pasar decimales como argumentos en el bucle; van en `cur`.
import { decimalFields } from '../../pool';

export const TAU = Math.PI * 2;
export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** Fuente (índice en HURT_SOURCES) del enemigo que está actuando: la heredan sus balas y avisos. */
export let curSrc = -1;
/** Lo fija `think` al empezar la IA de cada enemigo (un import no se puede reasignar desde otro módulo). */
export function setCurSrc(src: number): void {
  curSrc = src;
}

/**
 * Lo que el bucle de IA sabe del enemigo que actúa: distancia y dirección al jugador (`d`, `ux`, `uy`), velocidad
 * efectiva (`spd`) y, de vuelta, la velocidad deseada (`vx`, `vy`). Va aquí y no en argumentos: V8 guarda en su sitio
 * un decimal de un campo, pero cada decimal que cruza una llamada sin incorporar reserva memoria, y con 1 000
 * enemigos por tick eso llena el espacio joven. Tampoco sirven variables `let` de módulo: cada escritura reserva otra.
 */
export const cur = decimalFields({ d: 0, ux: 0, uy: 0, spd: 0, vx: 0, vy: 0 });
