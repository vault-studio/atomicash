// Hongo nuclear de la intro: nubes, bola de fuego, ondas, ceniza y tiempos.
import { type CSSProperties } from 'react';
import { BASE, CX } from './glyphs';
import { type Box, cells, hash, heated, shade, sprite } from './pixels';

// ---------- Explosión ----------

/** Bola de humo: elipse con luz de arriba a la izquierda. `x` es relativa al centro de la T. */
interface Puff {
  x: number;
  y: number;
  r: number;
  /** Achatado vertical (ry = r·s). */
  s?: number;
}

/** Un fotograma de la bola de fuego. */
interface Cloud {
  puffs: Puff[];
  heat: number;
  /** Desde esta y el sombrero se oscurece por debajo. */
  under?: number;
  /** Columna: y de arriba, ancho y cuánto se abre al llegar al suelo. */
  stem?: [top: number, w: number, flare: number];
  /** Polvo del suelo: semiejes. */
  skirt?: [rx: number, ry: number];
}

/** Intensidad de la nube en un punto (0 fuera … 1 al rojo blanco). */
function cloud(c: Cloud): (x: number, y: number) => number {
  return (x, y) => {
    let v = 0;
    for (const p of c.puffs) {
      const dx = (x - CX - p.x) / p.r;
      const dy = (y - p.y) / (p.r * (p.s ?? 1));
      const d2 = dx * dx + dy * dy;
      if (d2 <= 1) v = Math.max(v, 0.76 - 0.2 * (dx * 0.6 + dy * 0.8) - 0.14 * d2);
    }
    if (v > 0 && c.under !== undefined && y > c.under) v -= 0.17 * (y - c.under);
    if (c.stem) {
      const [top, w, flare] = c.stem;
      const k = (y - top) / (BASE - top);
      const half = w / 2 + flare * k * k * k;
      const dx = Math.abs(x - CX) / half;
      if (k >= 0 && k <= 1 && dx <= 1) v = Math.max(v, 0.8 - 0.3 * dx * dx);
    }
    if (c.skirt) {
      const [rx, ry] = c.skirt;
      const d2 = ((x - CX) / rx) ** 2 + ((y - BASE) / ry) ** 2;
      if (y <= BASE && d2 <= 1) v = Math.max(v, 0.12 + 0.36 * (1 - d2));
    }
    return v > 0 ? v + c.heat * 0.55 : 0;
  };
}

/** Caja donde cabe cualquier fotograma de la bola de fuego. */
const CLOUD_BOX: Box = [8, -6, 26, 21];

/** La T hecha hongo, a mano: sombrero de borbotones (el travesaño), cuello, anillo de condensación y columna que
 *  se abre en polvo al tocar el suelo. Va de x 12 a 28 y de y −2 a 14; la B solo cambia pliegues y tramado. */
const T_A = [
  '......#####......',
  '.###.#######.###.',
  '#####+#####+#####',
  '#################',
  '##+###########+##',
  '+##+#########+##+',
  '.-+-+-+###+-+-+-.',
  '.....-+###+-.....',
  '......+###+......',
  '.......###.......',
  '....-++###++-....',
  '.....--###--.....',
  '.......###.......',
  '......+###+......',
  '.....+#####+.....',
  '....-+#####+-....',
  '..-++#######++-..',
];
const T_B = [
  '......#####......',
  '.###.#######.###.',
  '####+#######+####',
  '########+########',
  '#+###+#####+###+#',
  '+#+###########+#+',
  '.+-+-+-###-+-+-+.',
  '.....+-###-+.....',
  '.......###.......',
  '......+###+......',
  '....+-+###+-+....',
  '.....-+###+-.....',
  '......+###+......',
  '.......###.......',
  '.....+#####+.....',
  '....-+#####+-....',
  '..-++#######++-..',
];
const T_X = 12;
const T_Y = -2;

/** Bola de fuego que sube y se aplasta en sombrero: [ms tras el impacto, ms en pantalla, forma]. */
const FIREBALL = (
  [
    [0, 50, { puffs: [{ x: 0, y: 13.6, r: 2.3 }], heat: 1 }],
    [50, 60, { puffs: [{ x: 0, y: 11.8, r: 4.3 }], skirt: [6, 1.4], heat: 0.9 }],
    [110, 70, { puffs: [{ x: 0, y: 9.8, r: 6 }], skirt: [9, 2], heat: 0.78 }],
    [
      180,
      80,
      { puffs: [{ x: 0, y: 6.6, r: 5.6, s: 0.9 }], stem: [10.5, 3.4, 2], skirt: [10, 2.2], heat: 0.62 },
    ],
    [
      260,
      100,
      {
        puffs: [
          { x: -3.2, y: 4.4, r: 3.6, s: 0.85 },
          { x: 3.2, y: 4.4, r: 3.6, s: 0.85 },
          { x: 0, y: 3.4, r: 4.4, s: 0.85 },
        ],
        under: 5.2,
        stem: [7.5, 3.2, 2.6],
        skirt: [9, 2],
        heat: 0.5,
      },
    ],
  ] as [number, number, Cloud][]
).map(([at, dur, c]) => ({ at, dur, tones: shade(CLOUD_BOX, cloud(c)) }));
/** Después, la T al rojo blanco que se enfría a pasos. */
export const FRAMES = [
  ...FIREBALL,
  { at: 360, dur: 110, tones: sprite(heated(T_A), T_X, T_Y) },
  { at: 470, dur: 120, tones: sprite(heated(T_A, true), T_X, T_Y) },
];
/** El hongo frío se queda desde aquí; dos variantes que se alternan para que hierva. */
export const CLOUD_AT = 590;
export const CLOUD_A = sprite(T_A, T_X, T_Y);
export const CLOUD_B = sprite(T_B, T_X, T_Y);

/** Onda expansiva a ras de suelo: anillo achatado que se abre y se deshace en metralla. */
export const WAVES = (
  [
    [20, 60, 6, 2.4, 1, 4],
    [80, 60, 12, 4.2, 0.9, 4],
    [140, 70, 20, 6.5, 0.75, 3],
    [210, 80, 30, 9, 0.6, 3],
    [290, 90, 42, 11.5, 0.45, 2],
    [380, 100, 56, 14, 0.32, 2],
    [480, 110, 72, 17, 0.2, 1],
  ] as const
).map(([at, dur, rx, ry, keep, tone]) => ({
  at,
  dur,
  tone,
  d: cells(
    [Math.floor(CX - rx) - 2, Math.floor(BASE - ry) - 2, Math.ceil(2 * rx) + 5, Math.ceil(2 * ry) + 5],
    (x, y) => {
      const ux = (x + 0.5 - CX) / rx;
      const uy = (y + 0.5 - BASE) / ry;
      const f = ux * ux + uy * uy - 1;
      const g = 2 * Math.hypot(ux / rx, uy / ry);
      return Math.abs(f) / g < 0.75 && hash(x + 400, y + 400) < keep;
    },
  ),
}));

export const timing = ({ at, dur }: { at: number; dur: number }) =>
  ({ '--at': `${at}ms`, '--dur': `${dur}ms` }) as CSSProperties;

// ---------- Ceniza ----------

/** Copos de ceniza que caen a saltos tras el impacto (posiciones fijas, pseudoaleatorias). */
export const ASH = Array.from(
  { length: 18 },
  (_, i) =>
    ({
      '--x': `${(hash(i, 1) * 100).toFixed(1)}%`,
      '--s': `${(0.5 + hash(i, 2) * 0.6).toFixed(2)}cqh`,
      '--fall': `${(3.2 + hash(i, 3) * 2.4).toFixed(2)}s`,
      '--wait': `${(0.25 + hash(i, 4) * 1.8).toFixed(2)}s`,
      '--drift': `${((hash(i, 5) - 0.5) * 10).toFixed(1)}cqw`,
    }) as CSSProperties,
);
