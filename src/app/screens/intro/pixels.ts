// Pixel art de la intro: tramado, cajas de celdas, sombreado y sprites de texto.
// ---------- Rejilla de fósforo ----------
// El título se dibuja en «píxeles gordos» (1 unidad del viewBox = 1 píxel del monitor) con 4 tonos de verde y
// tramado ordenado, como una pantalla monocroma de los 50. Los `d` se calculan una sola vez al cargar el módulo.

export type Box = [x: number, y: number, w: number, h: number];
/** Un `d` por tono: tenue, medio, fósforo y al rojo blanco. */
export type Tones = [string, string, string, string];

/** Matriz de Bayer 4×4 del tramado ordenado. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x: number, y: number): number => ((BAYER[(y & 3) * 4 + (x & 3)] ?? 0) + 0.5) / 16;
/** Ruido fijo por celda (0..1): metralla de la onda y ceniza. */
export const hash = (x: number, y: number): number => ((((x * 73856093) ^ (y * 19349663)) >>> 0) % 997) / 997;

/** `d` con un rectángulo por tramo horizontal de celdas encendidas dentro de la caja. */
export function cells([x0, y0, w, h]: Box, on: (x: number, y: number) => boolean): string {
  let d = '';
  for (let y = y0; y < y0 + h; y++) {
    let run: number | null = null;
    for (let x = x0; x <= x0 + w; x++) {
      const lit = x < x0 + w && on(x, y);
      if (lit && run === null) run = x;
      if (!lit && run !== null) {
        d += `M${run} ${y}h${x - run}v1h${run - x}z`;
        run = null;
      }
    }
  }
  return d;
}

/** Rasteriza una intensidad (0 apagado … 1 al rojo blanco) a los 4 tonos con tramado ordenado. */
export function shade(box: Box, v: (x: number, y: number) => number): Tones {
  const [x0, y0, w, h] = box;
  const lv = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const s = v(x0 + x + 0.5, y0 + y + 0.5);
      if (s > 0) lv[y * w + x] = Math.min(4, Math.floor(s * 4 + bayer(x0 + x, y0 + y)));
    }
  return [1, 2, 3, 4].map((k) => cells(box, (x, y) => lv[(y - y0) * w + (x - x0)] === k)) as Tones;
}

/** Sprite a mano con su esquina en (x0, y0): '-' tenue, '+' medio, '#' fósforo, '%' al rojo blanco. */
export function sprite(rows: string[], x0 = 0, y0 = 0): Tones {
  return ['-', '+', '#', '%'].map((c) =>
    cells([x0, y0, rows[0]?.length ?? 0, rows.length], (x, y) => rows[y - y0]?.[x - x0] === c),
  ) as Tones;
}

/** El mismo sprite un tono más caliente; con `half` solo en damero (se está enfriando). */
const HOTTER: Record<string, string> = { '-': '+', '+': '#', '#': '%' };
export const heated = (rows: string[], half = false): string[] =>
  rows.map((row, y) => [...row].map((c, x) => (half && (x + y) % 2 ? c : (HOTTER[c] ?? c))).join(''));
