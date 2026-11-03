// Composición de cercos (CAMBIOS §4): un anillo de varios roles que siempre deja una salida. TS puro y determinista.
import type { Rng } from './rng';

export interface RingPlan {
  /** Ángulo de cada puesto del anillo (rad). */
  readonly angles: number[];
  /** Tipo de cada puesto (índice en `types` de la mezcla). */
  readonly slots: number[];
  /** Centro y anchura (rad) de la salida, libre de enemigos. */
  readonly exitA: number;
  readonly gap: number;
}

/**
 * Reparte `n` enemigos en un anillo dejando libre un arco de `gap` rad (la salida) en un ángulo al azar. Cada
 * `heavyEvery` puestos va un pesado (de los tipos con `heavy`) para que el cerco no tenga huecos fáciles; el resto se
 * sortea por peso entre los no pesados. Si no hay pesados en la mezcla, todos son por peso.
 */
export function planRing(
  n: number,
  gap: number,
  heavyEvery: number,
  weights: readonly number[],
  heavy: readonly boolean[],
  rng: Rng,
): RingPlan {
  const exitA = rng() * Math.PI * 2;
  const arc = Math.PI * 2 - gap;
  const angles: number[] = [];
  const slots: number[] = [];
  let lightTotal = 0;
  let anyHeavy = false;
  for (let i = 0; i < weights.length; i++) {
    if (heavy[i]) anyHeavy = anyHeavy || weights[i]! > 0;
    else lightTotal += weights[i]!;
  }
  const pick = (wantHeavy: boolean): number => {
    let total = 0;
    for (let i = 0; i < weights.length; i++) if (!!heavy[i] === wantHeavy) total += weights[i]!;
    let r = rng() * total;
    let last = -1;
    for (let i = 0; i < weights.length; i++) {
      if (!!heavy[i] !== wantHeavy || !(weights[i]! > 0)) continue;
      last = i;
      r -= weights[i]!;
      if (r < 0) return i;
    }
    return last;
  };
  for (let i = 0; i < n; i++) {
    // Puestos repartidos de un borde de la salida al otro (el primero y el último la flanquean).
    angles.push(exitA + gap / 2 + (n > 1 ? (arc * i) / (n - 1) : arc / 2));
    const wantHeavy = anyHeavy && heavyEvery > 0 && i % heavyEvery === Math.floor(heavyEvery / 2);
    slots.push(wantHeavy || lightTotal <= 0 ? pick(true) : pick(false));
  }
  return { angles, slots, exitA, gap };
}

/** Mayor arco libre (rad) entre ángulos consecutivos del anillo: la salida más ancha que ve el jugador. */
export function widestGap(angles: readonly number[]): number {
  if (angles.length < 2) return Math.PI * 2;
  const a = angles.map((x) => ((x % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)).sort((x, y) => x - y);
  let best = a[0]! + Math.PI * 2 - a[a.length - 1]!;
  for (let i = 1; i < a.length; i++) best = Math.max(best, a[i]! - a[i - 1]!);
  return best;
}
