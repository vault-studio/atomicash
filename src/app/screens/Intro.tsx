import { useEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { audio } from '../../audio/audio';

/** Momento del impacto de la bomba en ms; intro.css lo recibe como `--impact`. */
const IMPACT_MS = 2000;
/** A partir de aquí el tubo se apaga (raya y punto) y la intro se quita al terminar. */
const INTRO_FADE_MS = 6000;
const INTRO_END_MS = 6600;
/** El subtítulo se escribe cuando el hongo ya se ha enfriado. */
const SUBTITLE_AT_MS = IMPACT_MS + 1300;

// ---------- Rejilla de fósforo ----------
// El título se dibuja en «píxeles gordos» (1 unidad del viewBox = 1 píxel del monitor) con 4 tonos de verde y
// tramado ordenado, como una pantalla monocroma de los 50. Los `d` se calculan una sola vez al cargar el módulo.

type Box = [x: number, y: number, w: number, h: number];
/** Un `d` por tono: tenue, medio, fósforo y al rojo blanco. */
type Tones = [string, string, string, string];

/** Matriz de Bayer 4×4 del tramado ordenado. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x: number, y: number): number => ((BAYER[(y & 3) * 4 + (x & 3)] ?? 0) + 0.5) / 16;
/** Ruido fijo por celda (0..1): metralla de la onda y ceniza. */
const hash = (x: number, y: number): number => ((((x * 73856093) ^ (y * 19349663)) >>> 0) % 997) / 997;

/** `d` con un rectángulo por tramo horizontal de celdas encendidas dentro de la caja. */
function cells([x0, y0, w, h]: Box, on: (x: number, y: number) => boolean): string {
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
function shade(box: Box, v: (x: number, y: number) => number): Tones {
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
function sprite(rows: string[], x0 = 0, y0 = 0): Tones {
  return ['-', '+', '#', '%'].map((c) =>
    cells([x0, y0, rows[0]?.length ?? 0, rows.length], (x, y) => rows[y - y0]?.[x - x0] === c),
  ) as Tones;
}

/** El mismo sprite un tono más caliente; con `half` solo en damero (se está enfriando). */
const HOTTER: Record<string, string> = { '-': '+', '+': '#', '#': '%' };
const heated = (rows: string[], half = false): string[] =>
  rows.map((row, y) => [...row].map((c, x) => (half && (x + y) % 2 ? c : (HOTTER[c] ?? c))).join(''));

// ---------- Título ----------

/** Letras de 15 píxeles de alto con trazo de 3. La T no está: la pone la bomba. */
const GLYPHS: Record<'A' | 'O' | 'M' | 'I' | 'C' | 'S' | 'H', string[]> = {
  A: [
    '...#####...',
    '..#######..',
    '.#########.',
    '####...####',
    '###.....###',
    '###.....###',
    '###.....###',
    '###########',
    '###########',
    '###########',
    '###.....###',
    '###.....###',
    '###.....###',
    '###.....###',
    '###.....###',
  ],
  O: [
    '..#######..',
    '.#########.',
    '###########',
    '####...####',
    '###.....###',
    '###.....###',
    '###.....###',
    '###.....###',
    '###.....###',
    '###.....###',
    '###.....###',
    '####...####',
    '###########',
    '.#########.',
    '..#######..',
  ],
  M: [
    '####.......####',
    '#####.....#####',
    '######...######',
    '###.###.###.###',
    '###..#####..###',
    '###...###...###',
    '###....#....###',
    '###.........###',
    '###.........###',
    '###.........###',
    '###.........###',
    '###.........###',
    '###.........###',
    '###.........###',
    '###.........###',
  ],
  I: Array.from({ length: 15 }, () => '###'),
  C: [
    '..#########',
    '.##########',
    '###########',
    '####.......',
    '###........',
    '###........',
    '###........',
    '###........',
    '###........',
    '###........',
    '###........',
    '####.......',
    '###########',
    '.##########',
    '..#########',
  ],
  S: [
    '..#########',
    '.##########',
    '###########',
    '###........',
    '###........',
    '###........',
    '##########.',
    '###########',
    '.##########',
    '........###',
    '........###',
    '........###',
    '###########',
    '##########.',
    '#########..',
  ],
  H: [
    '###.....###',
    '###.....###',
    '###.....###',
    '###.....###',
    '###.....###',
    '###.....###',
    '###.....###',
    '###########',
    '###########',
    '###########',
    '###.....###',
    '###.....###',
    '###.....###',
    '###.....###',
    '###.....###',
  ],
};

const WIDTH = 120;
const HEIGHT = 15;
/** Centro del hueco de la T (x 13..27) y línea de base: ahí revienta la bomba. */
const CX = 20.5;
const BASE = 15;

/** «A·OMIC ASH» con la x de cada letra; el empujón de la onda llega antes a las cercanas. */
const LETTERS = (
  [
    ['A', 0],
    ['O', 30],
    ['M', 43],
    ['I', 60],
    ['C', 65],
    ['A', 83],
    ['S', 96],
    ['H', 109],
  ] as const
).map(([c, x0], i) => {
  const rows = GLYPHS[c];
  const w = rows[0]?.length ?? 0;
  return {
    d: cells([x0, 0, w, HEIGHT], (x, y) => rows[y]?.[x - x0] === '#'),
    style: {
      '--i': i,
      '--dir': x0 < CX ? -1 : 1,
      '--near': Math.round(Math.abs(x0 + w / 2 - CX)),
    } as CSSProperties,
  };
});

// ---------- Bomba ----------

/** Bomba atómica de los 50, tipo «Fat Man»: cola de caja arriba, cuerpo de huevo con costura y morro abajo. */
const BOMB = sprite([
  '.###########.',
  '.#----#----#.',
  '.#----#----#.',
  '.###########.',
  '....##+##....',
  '...###+###...',
  '..##%#+++##..',
  '.##%++++++##.',
  '##%+++++++++#',
  '##++++++++++#',
  '#-#-#-#-#-#-#',
  '#++++++++++-#',
  '##+++++++++##',
  '.##+++++++##.',
  '..###+++###..',
  '....#####....',
]);

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
const FRAMES = [
  ...FIREBALL,
  { at: 360, dur: 110, tones: sprite(heated(T_A), T_X, T_Y) },
  { at: 470, dur: 120, tones: sprite(heated(T_A, true), T_X, T_Y) },
];
/** El hongo frío se queda desde aquí; dos variantes que se alternan para que hierva. */
const CLOUD_AT = 590;
const CLOUD_A = sprite(T_A, T_X, T_Y);
const CLOUD_B = sprite(T_B, T_X, T_Y);

/** Onda expansiva a ras de suelo: anillo achatado que se abre y se deshace en metralla. */
const WAVES = (
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

const timing = ({ at, dur }: { at: number; dur: number }) =>
  ({ '--at': `${at}ms`, '--dur': `${dur}ms` }) as CSSProperties;

// ---------- Ceniza ----------

/** Copos de ceniza que caen a saltos tras el impacto (posiciones fijas, pseudoaleatorias). */
const ASH = Array.from(
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

// ---------- Piezas ----------

/** Un fotograma de píxeles: un `path` por tono. */
function Pixels({ tones }: { tones: Tones }) {
  return <>{tones.map((d, k) => (d ? <path key={k} className={`intro__tone${k + 1}`} d={d} /> : null))}</>;
}

/** Texto a máquina: VT323 es monoespaciada, así que el ancho en ch avanza letra a letra. La caja de fuera ya
 *  tiene el ancho final para que el texto centrado no se mueva mientras se escribe. */
function Typed({ text, at, className = '' }: { text: string; at: number; className?: string }) {
  return (
    <span
      className={`intro__type ${className}`}
      style={{ '--n': [...text].length, '--at': `${at}ms` } as CSSProperties}
    >
      <span>{text}</span>
    </span>
  );
}

/** Desgarros del impacto: ruido que solo varía en vertical, cuantizado en franjas que empujan la imagen de lado. */
function TearFilters() {
  const tears: [id: string, seed: number, table: string][] = [
    ['a', 3, '0.5 0.5 0.8 0.5 0.5 0.3 0.62 0.5 0.5'],
    ['b', 11, '0.5 0.2 0.5 0.66 0.5 0.5 0.38 0.85 0.5'],
  ];
  return (
    <svg className="intro__defs" aria-hidden="true">
      {tears.map(([id, seed, table]) => (
        <filter
          key={id}
          id={`intro-tear-${id}`}
          x="-10%"
          y="0"
          width="120%"
          height="100%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence type="fractalNoise" baseFrequency="0 0.03" numOctaves={1} seed={seed} />
          <feComponentTransfer result="bands">
            <feFuncR type="discrete" tableValues={table} />
            <feFuncG type="discrete" tableValues="0.5" />
          </feComponentTransfer>
          <feDisplacementMap
            in="SourceGraphic"
            in2="bands"
            scale={56}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      ))}
    </svg>
  );
}

/** El título en píxeles: onda, letras, cursor en el hueco de la T, bola de fuego y el hongo que se queda de T. */
function Logo() {
  return (
    <svg className="intro__logo" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true">
      {WAVES.map((w, i) => (
        <path key={i} className={`intro__frame intro__tone${w.tone}`} d={w.d} style={timing(w)} />
      ))}
      {LETTERS.map((l, i) => (
        <path key={i} className="intro__glyph" d={l.d} style={l.style} />
      ))}
      <g className="intro__cursor">
        <rect x={15} y={13} width={11} height={2} />
      </g>
      {FRAMES.map((f, i) => (
        <g key={i} className="intro__frame" style={timing(f)}>
          <Pixels tones={f.tones} />
        </g>
      ))}
      <g className="intro__cloud" style={{ '--at': `${CLOUD_AT}ms` } as CSSProperties}>
        <g className="intro__boil">
          <Pixels tones={CLOUD_A} />
        </g>
        <g className="intro__boil intro__boil--b">
          <Pixels tones={CLOUD_B} />
        </g>
      </g>
    </svg>
  );
}

/** La bomba cayendo en el hueco de la T, con dos copias retrasadas que hacen de estela del fósforo. */
function Bomb() {
  return (
    <span className="intro__drop">
      {[0.07, 0.2, 1].map((glow, i, all) => (
        <svg
          key={i}
          className="intro__bomb"
          viewBox="0 0 13 16"
          style={{ '--lag': all.length - 1 - i, '--glow-a': glow } as CSSProperties}
          aria-hidden="true"
        >
          <Pixels tones={BOMB} />
        </svg>
      ))}
    </span>
  );
}

interface IntroProps {
  onDone: () => void;
}

/** Arranque del juego en un monitor de búnker: cae una bomba en el hueco de la T de «ATOMIC ASH» y su hongo se
 *  queda como la T. Se salta con un toque o una tecla. */
export function Intro({ onDone }: IntroProps) {
  const { t } = useTranslation();
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const boom = setTimeout(() => audio.play('boom', 4), IMPACT_MS);
    const fade = setTimeout(() => setLeaving(true), INTRO_FADE_MS);
    const end = setTimeout(onDone, INTRO_END_MS);
    const skip = (): void => onDone();
    window.addEventListener('keydown', skip);
    return () => {
      clearTimeout(boom);
      clearTimeout(fade);
      clearTimeout(end);
      window.removeEventListener('keydown', skip);
    };
  }, [onDone]);

  return (
    <div
      className={`intro${leaving ? ' intro--leaving' : ''}`}
      style={{ '--impact': `${IMPACT_MS}ms` } as CSSProperties}
      onPointerUp={onDone}
    >
      <TearFilters />
      <div className="intro__screen">
        <div className="intro__picture">
          <div className="intro__boot" aria-hidden="true">
            <Typed text={t('app.introBoot')} at={300} />
            <Typed text={t('app.introAlert')} at={850} className="intro__alert" />
          </div>
          <div className="intro__stage">
            <h1 className="intro__title" aria-label={t('app.title')}>
              <Logo />
              <Bomb />
            </h1>
            <p className="intro__sub">
              <Typed text={t('app.tagline')} at={SUBTITLE_AT_MS} />
            </p>
          </div>
          <div className="intro__ashes" aria-hidden="true">
            {ASH.map((style, i) => (
              <span key={i} className="intro__ash" style={style} />
            ))}
          </div>
          <div className="intro__flash" />
          <div className="intro__tint" />
        </div>
        <div className="intro__static" />
        <div className="intro__burst" />
        <div className="intro__roll" />
        <div className="intro__beam" />
      </div>
      <div className="intro__glass" />
    </div>
  );
}
