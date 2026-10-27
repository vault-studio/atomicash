// Estado de la run y tick(dt). TS puro: sin React, DOM ni Pixi.
import { PLAYER, RUN } from '../config/run';
import { SURVIVORS, type StatSurvivorId } from '../config/survivors';
import { createRng } from './rng';
import type { InputState, World } from './types';

export function createWorld(charId: StatSurvivorId, seed: number): World {
  const stats = SURVIVORS[charId];
  const c = RUN.mapSize / 2;
  return {
    seed,
    rng: createRng(seed),
    time: 0,
    ticks: 0,
    mapSize: RUN.mapSize,
    player: {
      charId,
      x: c,
      y: c,
      prevX: c,
      prevY: c,
      r: PLAYER.radius,
      speed: stats.speed,
      hp: stats.hp,
      maxHp: stats.hp,
      // Mirando hacia abajo en pantalla (fila S del sprite) en la vista isométrica.
      facingX: Math.SQRT1_2,
      facingY: Math.SQRT1_2,
      moving: false,
      deadAt: null,
    },
  };
}

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** Orden de sistemas (05_TECH.md §3). De momento solo existe el movimiento del jugador. */
export function tick(w: World, input: InputState, dt: number): void {
  const p = w.player;
  p.prevX = p.x;
  p.prevY = p.y;
  w.time += dt;
  w.ticks++;

  if (p.deadAt !== null) {
    p.moving = false;
    return;
  }

  const mag = Math.hypot(input.moveX, input.moveY);
  p.moving = mag > PLAYER.moveDeadzone;
  if (p.moving) {
    const ux = input.moveX / mag;
    const uy = input.moveY / mag;
    const k = Math.min(1, mag) * p.speed * dt;
    p.facingX = ux;
    p.facingY = uy;
    p.x = clamp(p.x + ux * k, p.r, w.mapSize - p.r);
    p.y = clamp(p.y + uy * k, p.r, w.mapSize - p.r);
  }
}

/** Mata al jugador (daño letal o depuración). La animación `death` se reproduce desde `deadAt`. */
export function killPlayer(w: World): void {
  const p = w.player;
  if (p.deadAt !== null) return;
  p.hp = 0;
  p.deadAt = w.time;
  p.moving = false;
}
