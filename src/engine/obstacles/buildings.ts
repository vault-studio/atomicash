// Edificios: estado, escaneo de zona, densidad de objetos y sitio libre para cofres.
import { HAZARDS } from '../../config/radiation';
import { BUILDINGS, PROP_BUILDING } from '../../config/props';
import { worldHazardAt } from '../hazards';
import type { Building, Hazard, Point, World } from '../types';
import { hitsObstacle } from './collision';
import { T, cell, createCellObject, worldObjectAt } from './grid';

export type BuildingState = 'new' | 'active' | 'done';

/** Sin visitar, con su guarnición aún viva o ya hecho (suministros: en cuanto salen sus cajas). */
export function buildingState(w: World, b: Building): BuildingState {
  if (!w.garrisoned.has(b.key)) return 'new';
  const x = b.x + BUILDINGS.cache.offset;
  const y = b.y + BUILDINGS.cache.offset;
  for (const g of w.garrisons) if (g.x === x && g.y === y && g.left > 0) return 'active';
  return 'done';
}

export interface AreaScan {
  readonly buildings: Building[];
  readonly objects: Point[];
  readonly lakes: Hazard[];
}

/** Lo que hay a `cells` casillas o menos del jugador, para el mapa de la pausa. Reserva memoria: fuera de la partida. */
export function scanArea(w: World, cells: number): AreaScan {
  const out: AreaScan = { buildings: [], objects: [], lakes: [] };
  const ci = Math.floor(w.player.x / T);
  const cj = Math.floor(w.player.y / T);
  for (let j = cj - cells; j <= cj + cells; j++)
    for (let i = ci - cells; i <= ci + cells; i++) {
      const hz = worldHazardAt(w, i, j);
      if (hz >= 0) out.lakes.push({ x: (i + 0.5) * T, y: (j + 0.5) * T, r: T * HAZARDS.cellRadii[hz]! });
      if (!worldObjectAt(w, i, j, cell) || i !== cell.i || j !== cell.j) continue;
      const kind = PROP_BUILDING[cell.prop];
      if (kind) out.buildings.push({ x: cell.x, y: cell.y, kind, key: `${cell.i},${cell.j}` });
      else out.objects.push({ x: cell.x, y: cell.y });
    }
  return out;
}

const probe = createCellObject();
export const BUILDING_WEIGHT = 100;

/**
 * Cuánto estorba lo que hay en el cuadrado de semilado r alrededor de (x, y): 0 si está despejado; cada casilla con ácido
 * u objeto suma 1 y un edificio, `BUILDING_WEIGHT`. Para colocar las zonas de objetivo.
 */
export function areaClutter(w: World, x: number, y: number, r: number): number {
  const i1 = Math.floor((x + r) / T);
  const j1 = Math.floor((y + r) / T);
  let n = 0;
  for (let j = Math.floor((y - r) / T); j <= j1; j++)
    for (let i = Math.floor((x - r) / T); i <= i1; i++) {
      if (worldHazardAt(w, i, j) >= 0) n++;
      else if (worldObjectAt(w, i, j, probe)) n += PROP_BUILDING[probe.prop] ? BUILDING_WEIGHT : 1;
    }
  return n;
}

/**
 * Sitio de un cofre: si (x, y) cae dentro de un edificio o detrás de él en pantalla, pasa a su esquina delantera o a
 * la derecha, las dos que se ven siempre; y si cae sobre un objeto, se adelanta hasta salir de él. Escribe en `out`.
 */
export function chestSpot(w: World, x: number, y: number, out: { x: number; y: number }): void {
  const C = BUILDINGS.chest;
  out.x = x;
  out.y = y;
  for (const b of w.buildings) {
    const u = x - b.x - (y - b.y);
    const v = x - b.x + (y - b.y);
    if (Math.abs(u) >= C.hideU || v <= -C.hideBack || v + Math.abs(u) >= C.hideFront) continue;
    out.x = b.x + BUILDINGS.cache.offset;
    out.y = b.y + (u > 0 ? -BUILDINGS.cache.offset : BUILDINGS.cache.offset);
    return;
  }
  for (let k = 0; k < C.nudges && hitsObstacle(w, out.x, out.y); k++) {
    out.x += C.nudge;
    out.y += C.nudge;
  }
}
