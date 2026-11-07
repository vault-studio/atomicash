// Campaña de tres actos: reloj del acto y transición al caer el jefe de un acto (no el Coloso, que gana la partida).
// 1) Caída: desaparece lo hostil y la chatarra va al jugador. 2) Espera a que recoja los cofres. 3) Fundido a negro.
// 4) `advanceAct`: mapa nuevo alrededor del jugador, que conserva lo suyo (nivel, armas, objetos, vida y RAD).
import { CAMPAIGN, LAST_ACT, type ActId } from '../../config/acts';
import { ELITES, GORE } from '../../config/enemies';
import { DAILY, OBJECTIVES } from '../../config/modes';
import { JUICE } from '../../config/run';
import { burst } from '../fx';
import { refreshHazards } from '../hazards';
import { refreshObstacles } from '../obstacles';
import type { PickupKind, World } from '../types';
import { resetMirrorBomb } from './mirror';
import { magnetPull } from './progression';

/** Segundos de run que lleva el acto en curso. */
export const actTime = (w: World): number => w.time - w.actStart;

/** Espera hasta el próximo élite, en s. */
export function eliteDelay(w: World): number {
  const k = w.dailyMod === 'elites' ? DAILY.elites.every : 1;
  return (ELITES.everyMin + w.rng() * (ELITES.everyMax - ELITES.everyMin)) * k;
}

/** Cuándo toca el siguiente evento especial, según `specialIdx`. */
export function nextSpecialAt(w: World): number {
  if (w.endless) return w.time + CAMPAIGN.specials.endlessEvery;
  const t = CAMPAIGN.specials.times[w.specialIdx];
  return t === undefined ? Infinity : w.actStart + t;
}

/** Relojes de todo lo que se sortea por acto: el primer élite, los eventos especiales y el primer objetivo. */
export function resetActTimers(w: World): void {
  w.nextElite = w.time + eliteDelay(w);
  w.specialIdx = 0;
  w.nextSpecial = nextSpecialAt(w);
  w.nextObjective = w.time + OBJECTIVES.first;
}

const isChest = (k: PickupKind): boolean => k === 'chest' || k === 'cache';

function hasChest(w: World): boolean {
  for (let i = 0; i < w.pickups.count; i++) if (isChest(w.pickups.items[i]!.kind)) return true;
  return false;
}

/** Los cofres que queden se ponen encima del jugador, que los recoge solo. */
function bringChests(w: World): void {
  const p = w.player;
  for (let i = 0; i < w.pickups.count; i++) {
    const k = w.pickups.items[i]!;
    if (!isChest(k.kind)) continue;
    k.x = p.x;
    k.y = p.y;
  }
}

/** Fase de caída: fuera enemigos (sin experiencia ni botín), balas, avisos, horda y lluvias; la chatarra va al jugador. */
function beginActClear(w: World): void {
  w.actClearAt = w.time;
  for (let i = 0; i < w.enemies.count; i++) {
    const e = w.enemies.items[i]!;
    if (!e.dead) burst(w, e.x, e.y, JUICE.parts.perKill, GORE[e.type], 1);
  }
  w.enemies.clear();
  w.bossAlive = 0;
  w.ebullets.clear();
  w.tele.clear();
  w.lobs.clear();
  w.horde = null;
  w.objective = null;
  w.downpour = null;
  w.rain = 0;
  magnetPull(w);
}

/** Salta al acto siguiente, con el mapa nuevo despejado alrededor del jugador. También lo usa el depurador. */
export function advanceAct(w: World): void {
  if (w.act >= LAST_ACT) return;
  w.act = (w.act + 1) as ActId;
  w.actStart = w.time;
  w.actBossDown = false;
  w.actClearAt = w.actFadeAt = -1;
  w.enemies.clear();
  w.bossAlive = 0;
  w.pickups.clear();
  w.gemCount = 0;
  w.barrels.clear();
  w.pools.clear();
  w.mines.clear();
  w.slimes.clear();
  w.corpses.clear();
  w.wrecks.clear();
  w.tele.clear();
  w.lobs.clear();
  w.ebullets.clear();
  w.scars.clear();
  w.hazards = [];
  w.buildings = [];
  w.garrisons.length = 0;
  w.garrisoned.clear();
  w.objective = null;
  w.horde = null;
  w.downpour = null;
  w.rain = 0;
  w.spawnAcc = 0;
  const p = w.player;
  w.start.x = p.x;
  w.start.y = p.y;
  w.hazardCell.i = w.hazardCell.j = Number.NaN;
  w.obstacleCell.i = w.obstacleCell.j = Number.NaN;
  refreshHazards(w);
  refreshObstacles(w);
  resetActTimers(w);
  resetMirrorBomb(w);
}

/** Un tick de la transición. Solo con el jugador vivo: si muere durante la espera, la partida acaba ahí. */
export function updateCampaign(w: World): void {
  if (w.actBossDown) {
    w.actBossDown = false;
    beginActClear(w);
    return;
  }
  if (w.actClearAt < 0) return;
  if (w.actFadeAt >= 0) {
    if (w.time - w.actFadeAt >= CAMPAIGN.fade) advanceAct(w);
    return;
  }
  const t = w.time - w.actClearAt;
  if (t >= CAMPAIGN.clearMax) bringChests(w);
  if (t >= CAMPAIGN.clearMin && !hasChest(w)) w.actFadeAt = w.time;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Opacidad 0–1 de la cortina: se cierra tras `actFadeAt` y se abre desde `actStart` (salvo en el primer acto). */
export function actCurtain(w: World): number {
  if (w.actFadeAt >= 0) return clamp01((w.time - w.actFadeAt) / CAMPAIGN.fade);
  if (w.actStart > 0) return clamp01(1 - (w.time - w.actStart) / CAMPAIGN.fade);
  return 0;
}
