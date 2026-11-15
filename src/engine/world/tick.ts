// Un paso de simulación: orden de sistemas (05_TECH.md §3) y DPS reciente.
import { PLAYER, PRESSURE, RUN } from '../../config/run';
import { refreshHazards } from '../hazards';
import { refreshObstacles } from '../obstacles';
import { banner, updateFx } from '../fx';
import { hurtIndex, noteHurt, samplePressure, surroundedBy } from '../runStats';
import { recalc } from '../stats';
import { updateCampaign } from '../systems/campaign';
import { resolveBlasts } from '../systems/combat';
import {
  compactEnemies,
  updateEnemies,
  updateEnemyBullets,
  updateSlimes,
  updateTelegraphs,
} from '../systems/enemies';
import { updateMirror } from '../systems/mirror';
import { updateBarrels, updateObjective } from '../systems/modes';
import { updateDownpour } from '../systems/rains';
import { updatePickups } from '../systems/progression';
import { updateSpawning } from '../systems/spawning';
import {
  updateFirePools,
  updateBurns,
  updateLobs,
  updateMines,
  updateShots,
  updateWeapons,
} from '../systems/weapons';
import type { InputState, World } from '../types';
import { killPlayer, updatePlayer, updateRadiation } from './player';

const sectorOcc = new Uint8Array(32);

/** Orden de sistemas (05_TECH.md §3): input → jugador → director → armas → proyectiles → IA → recogida. */
export function tick(w: World, input: InputState, dt: number): void {
  if (w.over || w.choice) {
    // Pausado: congela la interpolación.
    w.player.prevX = w.player.x;
    w.player.prevY = w.player.y;
    return;
  }
  const p = w.player;
  w.time += dt;
  w.ticks++;
  recalc(w);
  updatePlayer(w, input, dt);
  refreshHazards(w);
  refreshObstacles(w);
  updateRadiation(w, dt);

  w.enemyGrid.build(w.enemies.items, w.enemies.count);
  // Con el jefe del acto caído, el director se para hasta el acto siguiente.
  if (p.deadAt === null && w.actClearAt < 0) {
    updateSpawning(w, dt);
    updateObjective(w, dt);
    updateMirror(w);
    updateDownpour(w, dt);
  }
  updateWeapons(w, dt);
  updateShots(w, dt);
  updateLobs(w, dt);
  updateFirePools(w, dt);
  updateBurns(w, dt);
  updateMines(w, dt);
  resolveBlasts(w);
  updateEnemies(w, dt);
  if (w.time >= w.rs.nextPressure) {
    w.rs.nextPressure = w.time + PRESSURE.every;
    samplePressure(
      w.rs,
      w.time,
      w.enemies.count,
      surroundedBy(w, PRESSURE.r, PRESSURE.sectors, PRESSURE.minSectors, sectorOcc),
    );
  }
  updateEnemyBullets(w, dt);
  updateTelegraphs(w, dt);
  updateBarrels(w, dt);
  resolveBlasts(w);
  compactEnemies(w);
  updatePickups(w, dt);
  if (p.deadAt === null) updateCampaign(w);
  updateSlimes(w, dt);
  updateFx(w, dt);
  // Pico de DPS para el resumen (cada 0,25 s basta).
  if (w.ticks % 15 === 0) {
    const dps = currentDps(w);
    if (dps > w.peakDps) w.peakDps = dps;
  }

  // La Tormenta: al acabar el tiempo, daño creciente hasta morir.
  if (w.time >= RUN.stormStart && !w.won) {
    if (!w.storm) {
      w.storm = true;
      banner(w, 'banner.storm');
    }
    if (!p.god) {
      const d = (RUN.stormDps + RUN.stormDpsGrowth * (w.time - RUN.stormStart)) * dt;
      p.hp -= d;
      noteHurt(w.rs, hurtIndex('tormenta'), d, w.time);
    }
  }
  if (p.god && p.hp < 1) p.hp = 1;
  if (p.hp <= 0 && p.deadAt === null) killPlayer(w);
  // La run acaba cuando termina la animación de muerte.
  if (p.deadAt !== null && w.time - p.deadAt >= PLAYER.deathDelay) w.over = true;
}

/** DPS de los últimos 3 s. */
export function currentDps(w: World): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += w.dpsB[(w.dpsBucket - i) & 15]!;
  return sum / 3;
}
