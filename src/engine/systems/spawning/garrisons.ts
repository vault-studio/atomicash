// Guarniciones y cajas alrededor de los edificios la primera vez que el jugador se acerca.
import { BUILDINGS } from '../../../config/props';
import type { World } from '../../types';
import { addChest } from '../combat';
import { spawnEnemy } from '../enemies';
import { TAU, spawnable, spot } from './waves';

/** Pone a `n` cosas repartidas en un anillo alrededor del edificio, cada una con su ángulo. */
function aroundBuilding(w: World, x: number, y: number, k: number, n: number): void {
  const a = ((k + w.rng() * 0.5) / n) * TAU;
  const d = BUILDINGS.ring + (w.rng() * 2 - 1) * BUILDINGS.jitter;
  spot.x = x + Math.cos(a) * d;
  spot.y = y + Math.sin(a) * d;
}

/** La primera vez que el jugador se acerca a un edificio, aparece lo que lo rodea: su guarnición o cajas. */
export function updateGarrisons(w: World): void {
  const p = w.player;
  const D2 = BUILDINGS.trigger * BUILDINGS.trigger;
  for (let b = 0; b < w.buildings.length; b++) {
    const B = w.buildings[b]!;
    if ((B.x - p.x) ** 2 + (B.y - p.y) ** 2 > D2 || w.garrisoned.has(B.key)) continue;
    if (B.kind === 'supply') {
      w.garrisoned.add(B.key);
      const C = BUILDINGS.crates;
      const n = C.min + Math.floor(w.rng() * (C.max - C.min + 1));
      for (let k = 0; k < n; k++) {
        // Del lado derecho (−45°) a la esquina delantera (+45°): la cara del edificio que da a la cámara.
        const a = ((k + 0.25 + w.rng() * 0.5) / n - 0.5) * (TAU / 4);
        const d = BUILDINGS.chest.ring + w.rng() * BUILDINGS.chest.spread;
        addChest(w, 'crate', B.x + Math.cos(a) * d, B.y + Math.sin(a) * d, 16);
      }
      continue;
    }
    // Solo lo que ya pueda salir; si aún no hay nada, el edificio espera a que se vuelva a pasar cerca.
    const groups = BUILDINGS.enemies[w.act][B.kind].filter(([type]) => spawnable(w, type));
    let n = 0;
    for (const [, count] of groups) n += count;
    if (n === 0) continue;
    w.garrisoned.add(B.key);
    const gar = w.garrisons.length;
    w.garrisons.push({ x: B.x + BUILDINGS.cache.offset, y: B.y + BUILDINGS.cache.offset, left: n });
    let k = 0;
    for (const [type, count] of groups)
      for (let c = 0; c < count; c++) {
        aroundBuilding(w, B.x, B.y, k++, n);
        spawnEnemy(w, type, spot.x, spot.y).gar = gar;
      }
  }
}
