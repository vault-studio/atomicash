// Combate: API pública. Fuera de esta carpeta se importa solo desde aquí.
export {
  HIT_DIRECT,
  HIT_MELEE,
  HIT_RAW,
  HIT_KB_DIR,
  spriteIdFor,
  nearest,
  hitEnemy,
  queryEnemies,
  resolveBlasts,
} from './hit';
export {
  createPickup,
  addPickup,
  addChest,
  addCoupons,
  dropGems,
  dropKillGems,
  rollFieldPickup,
} from './drops';
export { heal, addRad, irradiatedChance, hurtPlayer } from './player';
export { killEnemy } from './kill';
