// Turno del director de aparición (oleadas, élites, hordas, eventos, guarniciones).
import { CAMPAIGN } from '../../../config/acts';
import { ENDLESS } from '../../../config/modes';
import { EVENTS, SPAWN, WAVES } from '../../../config/waves';
import type { Enemy, World } from '../../types';
import { actTime } from '../campaign';
import { spawnEnemy } from '../enemies';
import { updateGarrisons } from './garrisons';
import { spawnBoss, updateSpecials } from './specials';
import { currentWaveIndex, pickType, placeOffscreen, ringPos, spot } from './waves';

export function updateSpawning(w: World, dt: number): void {
  // Con un jefe vivo los edificios esperan: su guarnición saldrá cuando se vuelva a pasar cerca.
  if (w.bossAlive === 0) updateGarrisons(w);
  const waveIdx = currentWaveIndex(w.act, actTime(w));
  const wave = WAVES[waveIdx]!;
  const pool = w.enemies;

  // Los que se quedan muy atrás vuelven a aparecer delante, fuera de cámara (los jefes y las guarniciones no).
  const p = w.player;
  const R2 = SPAWN.relocateDist * SPAWN.relocateDist;
  for (let i = 0; i < pool.count; i++) {
    const e = pool.items[i] as Enemy;
    if (e.boss || e.gar >= 0 || e.dead) continue;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    if (dx * dx + dy * dy > R2) {
      placeOffscreen(w, spot);
      e.x = e.prevX = spot.x;
      e.y = e.prevY = spot.y;
      // Una estampida que ya cruzó vuelve como enemigo normal.
      e.march = 0;
    }
  }

  // Infinito: cada minuto, más ritmo y más tope (hasta el máximo de enemigos del mundo).
  const em = w.endless ? (w.time - w.endlessAt) / 60 : 0;
  const maxAlive = Math.min(w.maxEnemies, wave.max * (1 + em * ENDLESS.maxPerMin));
  const rate =
    (1 + em * ENDLESS.ratePerMin) *
    wave.rate *
    SPAWN.rateMult *
    (w.rain > 0 ? EVENTS.rain.spawnMult : 1) *
    (w.bossAlive > 0 ? SPAWN.bossRateMult : 1);
  w.spawnAcc += rate * dt;
  let alive = pool.count - w.bossAlive;
  while (w.spawnAcc >= 1) {
    w.spawnAcc -= 1;
    if (alive >= maxAlive) {
      // Al tope: no se acumulan apariciones pendientes para cuando mueran.
      w.spawnAcc = 0;
      break;
    }
    const type = pickType(w, waveIdx);
    if (!type) break;
    if (type === 'torreta')
      ringPos(w, (SPAWN.staticMin + SPAWN.staticMax) / 2, (SPAWN.staticMax - SPAWN.staticMin) / 2);
    else placeOffscreen(w, spot);
    spawnEnemy(w, type, spot.x, spot.y);
    alive++;
  }

  updateSpecials(w, dt);
  if (w.rain > 0) w.rain -= dt;

  // Cada jefe, a su hora dentro de su acto. Ninguno vuelve en infinito.
  const boss = CAMPAIGN.acts[w.act].boss;
  if (!w.endless && !w.bossSpawned[boss] && actTime(w) >= CAMPAIGN.bossAt) spawnBoss(w, boss);
}
