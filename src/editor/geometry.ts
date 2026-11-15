// Geometría del editor: la misma proyección isométrica y el mismo tamaño de casilla que el juego.
import { isoX, isoY } from '../engine/view';
import { pieceCells, type EventPiece } from '../config/events';
import { TILES } from '../config/render';
import { RUN } from '../config/run';

/** Lado de una casilla del suelo en px de mundo. */
export const T = RUN.groundCell;
/** Px de mundo por px de imagen de una baldosa (igual que render/ground/view.ts). */
export const TILE_SCALE = ((T * Math.SQRT2) / TILES.imageWidth) * TILES.overlap;
/** Casillas a cada lado de la central en un evento de lado `size`. */
export const halfOf = (size: number): number => (size - 1) / 2;

export { isoX, isoY };

/** Centro de la casilla (x, y) en px de mundo: la casilla central está en el origen. */
export const cellWorld = (x: number, y: number): [number, number] => [x * T, y * T];

/** Punto de apoyo de una pieza en px de mundo: el centro de su huella. */
export function pieceWorld(p: Pick<EventPiece, 'type' | 'id' | 'x' | 'y' | 'flip'>): [number, number] {
  const cells = pieceCells(p);
  let sx = 0;
  let sy = 0;
  for (const [x, y] of cells) {
    sx += x;
    sy += y;
  }
  return cellWorld(sx / cells.length, sy / cells.length);
}

/** Casilla bajo un punto de pantalla relativo al origen del mapa, en px de mundo (sin zoom). */
export function cellAtScreen(px: number, py: number): [number, number] {
  const a = px / Math.SQRT1_2; // x − y
  const b = (2 * py) / Math.SQRT1_2; // x + y
  return [Math.round((a + b) / 2 / T), Math.round((b - a) / 2 / T)];
}

export const inside = (x: number, y: number, size: number): boolean =>
  Math.abs(x) <= halfOf(size) && Math.abs(y) <= halfOf(size);

/** Rombo de una casilla en coordenadas de pantalla, para el `points` de un polígono SVG. */
export function diamond(x: number, y: number): string {
  const [cx, cy] = cellWorld(x, y);
  const h = T / 2;
  const corners: [number, number][] = [
    [cx - h, cy - h],
    [cx + h, cy - h],
    [cx + h, cy + h],
    [cx - h, cy + h],
  ];
  return corners.map(([wx, wy]) => `${isoX(wx, wy).toFixed(1)},${isoY(wx, wy).toFixed(1)}`).join(' ');
}

const cellCache = new Map<number, readonly [number, number][]>();

/** Todas las casillas de un mapa de lado `size`, de atrás hacia delante. */
export function cellsOf(size: number): readonly [number, number][] {
  let out = cellCache.get(size);
  if (!out) {
    const h = halfOf(size);
    const list: [number, number][] = [];
    for (let y = -h; y <= h; y++) for (let x = -h; x <= h; x++) list.push([x, y]);
    out = list.sort((p, q) => p[0] + p[1] - (q[0] + q[1]));
    cellCache.set(size, out);
  }
  return out;
}

/** Semiancho y semialto en pantalla (px de mundo) de un mapa de lado `size`. */
export function mapHalf(size: number): { w: number; h: number } {
  const e = (halfOf(size) + 0.5) * T;
  return { w: isoX(e, -e), h: isoY(e, e) };
}
