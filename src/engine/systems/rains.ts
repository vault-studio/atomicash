// Lluvias que cambian el mapa: de chatarra (rompe el suelo y deja escombros) y de ácido (gotas grandes que dejan un lago).
// Cada objeto se marca en el suelo antes de caer; el aviso lo resuelve `updateTelegraphs`, que deja el destrozo.
// Las lanza un evento especial (spawning.ts). No confundir con `w.rain`, la lluvia radiactiva, que da experiencia y no
// toca el mapa.
import { RAINS, type RainKind } from '../../config/modes';
import { HAZARDS } from '../../config/radiation';
import { RUN } from '../../config/run';
import { banner } from '../fx';
import { hurtIndex } from '../runStats';
import { markFall, scarFree } from '../scars';
import { SFX, sfx } from '../sfx';
import type { World } from '../types';

const T = RUN.groundCell;
const TAU = Math.PI * 2;
const SCRAP_SRC = hurtIndex('chatarra');
const ACID_SRC = hurtIndex('acido');
const spot = { i: 0, j: 0 };

/** Empieza una lluvia; sin `kind`, la siguiente del turno. */
export function startDownpour(w: World, kind?: RainKind): void {
  const k = kind ?? RAINS.order[w.downpourIdx++ % RAINS.order.length]!;
  w.downpour = { kind: k, left: RAINS[k].dur, next: 0 };
  sfx(w, SFX.boss);
  banner(w, `banner.${k}Rain`);
}

/**
 * Casilla donde caerá algo: a veces la que pisará el jugador si sigue igual y, si no, una al azar a su alrededor.
 * Devuelve false si tras `RAINS.tries` intentos no encuentra una libre.
 */
function pickCell(w: World, warn: number, radius: number, aim: number): boolean {
  const p = w.player;
  for (let k = 0; k < RAINS.tries; k++) {
    let x = p.x + p.vx * warn;
    let y = p.y + p.vy * warn;
    if (k > 0 || w.rng() >= aim) {
      const a = w.rng() * TAU;
      const d = Math.sqrt(w.rng()) * radius;
      x = p.x + Math.cos(a) * d;
      y = p.y + Math.sin(a) * d;
    }
    spot.i = Math.floor(x / T);
    spot.j = Math.floor(y / T);
    if (scarFree(w, spot.i, spot.j)) return true;
  }
  return false;
}

function drop(w: World, kind: RainKind): void {
  const D = RAINS[kind];
  if (!pickCell(w, D.warn, D.radius, D.aimChance)) return;
  const x = (spot.i + 0.5) * T;
  const y = (spot.j + 0.5) * T;
  if (kind === 'acid') {
    const hz = Math.floor(w.rng() * HAZARDS.cellRadii.length);
    markFall(w, x, y, T * HAZARDS.cellRadii[hz]!, D.warn, D.dmg, D.rad, ACID_SRC, 'acid', hz);
  } else markFall(w, x, y, RAINS.scrap.r, D.warn, D.dmg, D.rad, SCRAP_SRC, 'scrap');
}

export function updateDownpour(w: World, dt: number): void {
  if (!w.hazardsOn) return;
  const d = w.downpour;
  if (!d) return;
  d.left -= dt;
  d.next -= dt;
  if (d.left <= 0) w.downpour = null;
  else if (d.next <= 0) {
    d.next += RAINS[d.kind].every;
    drop(w, d.kind);
  }
}
