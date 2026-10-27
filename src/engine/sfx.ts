// Eventos sonoros del motor. El motor solo cuenta; la capa de audio decide qué y cuánto suena.
import type { World } from './types';

export const SFX = {
  shot: 0,
  hit: 1,
  kill: 2,
  pickup: 3,
  hurt: 4,
  boom: 5,
  zap: 6,
  boss: 7,
  dodge: 8,
} as const;

export type SfxId = keyof typeof SFX;
export const SFX_COUNT = 9;

export function sfx(w: World, id: (typeof SFX)[SfxId]): void {
  w.sfx[id] = w.sfx[id]! + 1;
}
