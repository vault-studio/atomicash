// Estado de la run y tick(dt): API pública. TS puro: sin React, DOM ni Pixi.
export type { WorldOptions } from './options';
export { killPlayer } from './player';
export { tick, currentDps } from './tick';
export { results } from './results';
export type { RunResults } from './results';
export { createWorld } from './create';
