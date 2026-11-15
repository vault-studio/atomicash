// Aparición de enemigos: API pública. Fuera de esta carpeta se importa solo desde aquí.
export { currentWaveIndex, currentWave, unlocked, spawnable, placeOffscreen } from './waves';
export { updateSpawning } from './update';
export { spawnBoss, rollSpecial, spawnElite, announceHorde } from './specials';
export type { SpecialKind } from './specials';
