// Cálculos de los restos de robots, sin Pixi: cómo se parte un sprite en trozos y por dónde vuela cada uno.
import { ENTITIES, type EntityId } from '../config/entities';
import { VIEW } from '../config/render';

/** Ancho en px de mundo de la celda del sprite: de él salen el tamaño de la explosión y lo lejos que llegan las piezas. */
export function wreckWidth(id: EntityId): number {
  const d = ENTITIES[id];
  return d.size * VIEW.scalePerSize[d.category] * VIEW.refCell;
}

/** Número de 0 a 1 que depende solo de sus argumentos: sin estado ni reservas de memoria. */
export function wreckRand(seed: number, a: number, b: number): number {
  const v = Math.sin(seed * 12.9898 + a * 78.233 + b * 37.719) * 43758.5453;
  return v - Math.floor(v);
}

export interface ShatterConfig {
  /** Alfa mínima para que un píxel pueda ser semilla de un trozo. */
  readonly alpha: number;
  /** Candidatas por semilla: se queda la más lejana a las demás, y así no salen trozos enanos. */
  readonly tries: number;
  /** Diferencia de tamaño entre trozos (0 = iguales). */
  readonly uneven: number;
  /** Amplitud de la rotura, en fracción del ancho: cuanto más, menos rectos los cortes. */
  readonly jag: number;
  /** Anchura en px (a 256 px de celda) del borde quemado de cada corte. */
  readonly seam: number;
}

export interface Shard {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  area: number;
}

export interface Shatter {
  /** Trozo de cada píxel (−1 = transparente). */
  readonly owner: Int16Array;
  /** 1 en los píxeles pegados a un corte. */
  readonly seam: Uint8Array;
  readonly shards: readonly Shard[];
}

/**
 * Reparte los píxeles visibles de una imagen de `w`×`h` en `n` trozos irregulares: cada píxel va a la semilla más
 * cercana, con la posición ondulada para que los cortes parezcan chapa rota y no rectas.
 */
export function shatter(
  alpha: ArrayLike<number>,
  w: number,
  h: number,
  n: number,
  seed: number,
  S: ShatterConfig,
): Shatter {
  const owner = new Int16Array(w * h).fill(-1);
  const seam = new Uint8Array(w * h);
  const solid: number[] = [];
  for (let i = 0; i < w * h; i++) if (alpha[i]! >= S.alpha) solid.push(i);
  if (solid.length === 0) return { owner, seam, shards: [] };

  const sx: number[] = [];
  const sy: number[] = [];
  const weight: number[] = [];
  for (let k = 0; k < n; k++) {
    let best = solid[0]!;
    let bestD = -1;
    for (let c = 0; c < S.tries; c++) {
      const i = solid[Math.floor(wreckRand(seed, k, c) * solid.length)]!;
      const x = i % w;
      const y = Math.floor(i / w);
      let d = Infinity;
      for (let m = 0; m < k; m++) d = Math.min(d, (x - sx[m]!) ** 2 + (y - sy[m]!) ** 2);
      if (d > bestD) {
        bestD = d;
        best = i;
      }
    }
    sx.push(best % w);
    sy.push(Math.floor(best / w));
    weight.push(1 + (wreckRand(seed, k, 99) * 2 - 1) * S.uneven);
  }

  const shards: Shard[] = [];
  for (let k = 0; k < n; k++) shards.push({ x0: w, y0: h, x1: -1, y1: -1, area: 0 });
  const amp = S.jag * w;
  const f1 = 28 / w;
  const f2 = 95 / w;
  const margin = (S.seam * w) / 256;
  const ph = seed * 6.28;
  for (let y = 0; y < h; y++) {
    const jx = amp * (Math.sin(y * f1 + ph) + 0.5 * Math.sin(y * f2 + ph * 2));
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (alpha[i] === 0) continue;
      const jy = amp * (Math.sin(x * f1 + ph * 3) + 0.5 * Math.sin(x * f2 + ph * 4));
      const px = x + jx;
      const py = y + jy;
      let first = Infinity;
      let second = Infinity;
      let m = 0;
      for (let k = 0; k < n; k++) {
        const dx = px - sx[k]!;
        const dy = py - sy[k]!;
        const d = Math.sqrt(dx * dx + dy * dy) / weight[k]!;
        if (d < first) {
          second = first;
          first = d;
          m = k;
        } else if (d < second) second = d;
      }
      owner[i] = m;
      if (second - first < margin) seam[i] = 1;
      const s = shards[m]!;
      if (x < s.x0) s.x0 = x;
      if (x > s.x1) s.x1 = x;
      if (y < s.y0) s.y0 = y;
      if (y > s.y1) s.y1 = y;
      s.area++;
    }
  }
  return { owner, seam, shards };
}

export interface PieceMotion {
  /** Segundos en el aire. */
  readonly air: number;
  /** Px/s de caída extra de lo que iba volando: el dirigible tarda más en llegar al suelo. */
  readonly fall: number;
  /** Hasta dónde llega una pieza y qué altura coge, en fracción del ancho del robot. */
  readonly reach: number;
  readonly pop: number;
  /** Cuánto frena el peso a las piezas grandes: el casco se queda cerca de donde murió. */
  readonly heavy: number;
  /** Radianes de giro en el aire y giro máximo con el que queda en el suelo. */
  readonly spin: number;
  readonly turn: number;
}

export interface PieceState {
  /** Desplazamiento en pantalla respecto a los pies del robot y altura sobre el suelo. */
  x: number;
  y: number;
  z: number;
  rot: number;
  /** Parte del vuelo recorrida: 1 = ya está en el suelo. */
  f: number;
}

/**
 * Dónde está la pieza `j` `t` s después de reventar. A los 0 s las piezas forman el robot; `ox`, `oy` es el centro de
 * la pieza respecto a sus pies y `frac`, la parte del robot que ocupa.
 */
export function pieceAt(
  o: PieceState,
  seed: number,
  j: number,
  ox: number,
  oy: number,
  frac: number,
  width: number,
  lift: number,
  t: number,
  M: PieceMotion,
): PieceState {
  const T = M.air * (0.7 + 0.6 * wreckRand(seed, j, 0)) + lift / M.fall;
  const f = Math.min(1, t / T);
  const heavy = 1 - Math.min(0.85, frac * M.heavy);
  const nx = ox / (width / 2) + (wreckRand(seed, j, 1) - 0.5) * 1.6;
  const ny = (wreckRand(seed, j, 2) - 0.5) * 2;
  const len = Math.hypot(nx, ny) || 1;
  const dist = width * M.reach * (0.35 + 0.65 * wreckRand(seed, j, 3)) * heavy;
  const peak = width * M.pop * (0.4 + 0.6 * wreckRand(seed, j, 4)) * heavy;
  o.x = ox + (nx / len) * dist * f;
  o.y = (ny / len) * dist * 0.5 * f;
  o.z = (lift - oy) * (1 - f * f) + peak * 4 * f * (1 - f);
  o.rot = (wreckRand(seed, j, 5) - 0.5) * 2 * M.turn + (1 - f) * (wreckRand(seed, j, 6) - 0.5) * 2 * M.spin;
  o.f = f;
  return o;
}
