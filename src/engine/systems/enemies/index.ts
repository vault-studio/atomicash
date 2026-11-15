// Enemigos: API pública del sistema. Fuera de esta carpeta se importa solo desde aquí.
export { createEnemy, createBullet, createTele, createSlime } from './factories';
export { spawnEnemy, makeElite, removeEnemyAt } from './spawn';
export { compactEnemies } from './rage';
export { fireBullet } from './actions';
export { interruptEnemy } from './dash';
export { updateEnemies } from './update';
export { updateEnemyBullets, updateTelegraphs, updateSlimes } from './projectiles';
export { SLOGAN_COUNT } from './think';
