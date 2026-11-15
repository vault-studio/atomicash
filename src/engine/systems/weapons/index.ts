// Armas del jugador: API pública. Fuera de esta carpeta se importa solo desde aquí.
export { createShot, createLob, createFirePool, createMine, createWeapon, addFirePool } from './factories';
export { updateBurns } from './burns';
export { updateShots, updateLobs, updateFirePools, updateMines } from './projectiles';
export { updateWeapon, updateWeapons } from './fire';
