// Pantalla de carga de la expedición: un monitor viejo de fósforo verde que recibe la emisión de una prueba nuclear.
// El hongo se pinta píxel a píxel en un canvas diminuto (tramado ordenado, seis tonos de fósforo que tardan en
// apagarse) que el navegador amplía sin suavizar, a 12 fotogramas por segundo, como los juegos de cinta del aparato de
// muñeca. El tubo (sacudida, destello, nieve, parpadeo, barra de barrido y líneas) va en CSS (nukeload.css). El reloj
// del dibujo es una animación CSS de relleno: así todo se congela y se inspecciona a la vez con document.getAnimations().
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { audio } from '../../audio/audio';

/** Fotogramas por segundo del hongo. */
const FPS = 12;
/** Línea del suelo, en fracción del alto desde arriba (debajo va el texto). */
const GROUND = 0.79;
/** Periodo de la barra de barrido (cuadra con load-roll en nukeload.css). */
const ROLL_MS = 3600;
/** Fotograma fijo con movimiento reducido: el hongo ya formado. */
const STILL_FRAME = 30;
/** Seis tonos de fósforo, de nada a quemado, en RGBA empaquetado (little-endian) para escribir de golpe. */
const PALETTE = [
  [0, 0, 0, 0],
  [8, 44, 20, 255],
  [18, 96, 42, 255],
  [36, 172, 72, 255],
  [60, 255, 107, 255],
  [214, 255, 224, 255],
].map(([r = 0, g = 0, b = 0, a = 0]) => ((a << 24) | (b << 16) | (g << 8) | r) >>> 0);
const TOP = PALETTE.length - 1;
/** Tonos que pierde por fotograma lo que se apaga (la estela del fósforo). */
const DECAY = 2;
/** Umbrales del tramado ordenado (Bayer 4×4). */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((n) => (n + 0.5) / 16);
/** Luz de arriba, algo a la izquierda y de frente (vector unitario). */
const LX = -0.3;
const LY = 0.6;
const LZ = 0.74;
/** Radio de cada bola de humo dentro de su celda de Worley. */
const RP = 0.6;
/** Motas de ceniza que caen. */
const ASH = 55;
/** Columnas de sobra a cada lado de las tablas por columna, para las filas que el desgarro mueve de lado. */
const MARGIN = 24;

/** Lado del píxel del dibujo en px CSS: múltiplo de 3 para caer justo en las líneas del filtro CRT (styles.css). */
const pixelSize = (h: number): number => 3 * Math.max(1, Math.round(h / 420));

interface Grid {
  pw: number;
  ph: number;
  /** Fila del suelo. */
  gj: number;
  /** Píxeles por alto de pantalla (las medidas del hongo van en altos de pantalla). */
  unit: number;
  img: ImageData | null;
  px: Uint32Array;
  /** Tono de cada píxel en el fotograma anterior. */
  lv: Uint8Array;
  /** Por columna (con MARGIN de sobra): cresta de la sierra, que no se mueve, y borde del polvo y sombra del pliegue,
   * que se recalculan en cada fotograma. */
  ridge: Float32Array;
  dust: Float32Array;
  fold: Float32Array;
}

/** Pantalla de carga de la expedición: el hongo nuclear en la pantalla de fósforo del aparato. */
export function ExpeditionLoader({ leaving }: { leaving: boolean }) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clockRef = useRef<HTMLElement>(null);
  const sigRef = useRef<HTMLElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const radRef = useRef<HTMLSpanElement>(null);
  useEffect(() => audio.play('boom', 3), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const clock = clockRef.current;
    const box = canvas?.parentElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !clock || !box || !ctx) return;
    const still = document.documentElement.classList.contains('reduce-motion');
    const g: Grid = {
      pw: 0,
      ph: 0,
      gj: 0,
      unit: 1,
      img: null,
      px: new Uint32Array(0),
      lv: new Uint8Array(0),
      ridge: new Float32Array(0),
      dust: new Float32Array(0),
      fold: new Float32Array(0),
    };
    let raf = 0;
    let last = -1;
    let anim: Animation | undefined;

    const fit = (): void => {
      const w = box.clientWidth;
      const h = box.clientHeight;
      if (!w || !h) return;
      const s = pixelSize(h);
      g.pw = Math.ceil(w / s);
      g.ph = Math.ceil(h / s);
      g.gj = Math.round((h * GROUND) / s);
      g.unit = h / s;
      canvas.width = g.pw;
      canvas.height = g.ph;
      canvas.style.width = `${g.pw * s}px`;
      canvas.style.height = `${g.ph * s}px`;
      g.img = ctx.createImageData(g.pw, g.ph);
      g.px = new Uint32Array(g.img.data.buffer);
      g.lv = new Uint8Array(g.pw * g.ph);
      g.ridge = new Float32Array(g.pw + 2 * MARGIN);
      g.dust = new Float32Array(g.ridge.length);
      g.fold = new Float32Array(g.ridge.length);
      // Sierra lejana a los lados (en el centro, -1: nada), algo más alta hacia los bordes.
      for (let c = 0; c < g.ridge.length; c++) {
        const x = (c - MARGIN - g.pw / 2) / g.unit;
        const ax = Math.abs(x);
        g.ridge[c] = ax > 0.2 ? 0.01 + 0.05 * noise(x * 2.4 + 9, 1.7) * smooth(0.2, 0.7, ax) : -1;
      }
      last = -1;
    };

    const tick = (): void => {
      raf = requestAnimationFrame(tick);
      anim ??= clock.getAnimations()[0];
      const ms = Number(anim?.currentTime ?? 0);
      const f = still ? STILL_FRAME : Math.floor((ms * FPS) / 1000);
      if (f === last || !g.img) return;
      // La estela solo tiene sentido entre fotogramas seguidos (no al saltar el reloj).
      const trail = f === last + 1;
      last = f;
      paint(ctx, g, f, still ? 0 : ms, trail);
      readouts(f, ms, sigRef.current, timeRef.current, radRef.current);
    };

    const ro = new ResizeObserver(fit);
    ro.observe(box);
    fit();
    tick();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div className={`nukeload${leaving ? ' nukeload--leaving' : ''}`}>
      <div className="nukeload__screen">
        <canvas ref={canvasRef} className="nukeload__img" aria-hidden="true" />
        <div className="nukeload__top" aria-hidden="true">
          <span className="nukeload__tag">
            {t('app.loaderSignal')}
            <b className="nukeload__sig" ref={sigRef}>
              <i />
              <i />
              <i />
              <i />
              <i />
            </b>
          </span>
          <span className="nukeload__rule" />
          <span className="nukeload__tag">CAM 07</span>
        </div>
        <div className="nukeload__text">
          {/* En VT323 pequeña el «…» parece un guion bajo: tres puntos sueltos se leen mejor. */}
          <span className="nukeload__type">{t('app.expedition').replace('…', '...')}</span>
          <span className="nukeload__bar" aria-hidden="true">
            <i />
          </span>
        </div>
        <div className="nukeload__bottom" aria-hidden="true">
          <span className="nukeload__box" ref={timeRef}>
            T+00:00.00
          </span>
          <span className="nukeload__box" ref={radRef}>
            RAD 0000
          </span>
        </div>
      </div>
      <div className="nukeload__grain" />
      <div className="nukeload__roll" />
      <div className="nukeload__glass" />
      <div className="nukeload__flash" />
      <i className="nukeload__clock" ref={clockRef} />
    </div>
  );
}

/** Cifras del borde: barras de señal que se enganchan, reloj desde la detonación y dosímetro que se dispara. */
function readouts(
  f: number,
  ms: number,
  sig: HTMLElement | null,
  time: HTMLElement | null,
  rad: HTMLElement | null,
): void {
  const tau = f / FPS;
  const bars = tau < 0.35 ? 0 : tau < 0.55 ? 2 : tau < 0.8 ? 3 : hash(f >> 2, 5) > 0.8 ? 4 : 5;
  sig?.querySelectorAll('i').forEach((el, i) => el.classList.toggle('on', i < bars));
  if (time) {
    const s = Math.floor(ms / 1000);
    const cs = Math.floor((ms % 1000) / 10);
    time.textContent = `T+${pad(Math.floor(s / 60))}:${pad(s % 60)}.${pad(cs)}`;
  }
  if (rad)
    rad.textContent = `RAD ${String(Math.floor(40 + 8800 * ease(tau / 2.4) + hash(f, 9) * 37)).padStart(4, '0')}`;
}

/**
 * Pinta el fotograma `f` del hongo; `ms` es el reloj real (para la barra de barrido) y `trail` deja que lo que se
 * apaga lo haga poco a poco, como el fósforo. Va de atrás hacia delante: sierra, halo, tallo, polvo, anillo, sombrero
 * y onda de choque; las medidas van en altos de pantalla, con y = 0 en el suelo.
 */
function paint(ctx: CanvasRenderingContext2D, g: Grid, f: number, ms: number, trail: boolean): void {
  const { pw, ph, gj, unit, px, lv, ridge, dust, fold } = g;
  const tau = f / FPS;

  // Cómo va la explosión: la bola sube y se aplasta en sombrero, el tallo la sigue y el polvo se abre por el suelo.
  const rise = ease((tau - 0.05) / 1.8);
  const heat = 1 - 0.85 * ease(tau / 2.2);
  const a = 0.07 + 0.27 * rise;
  const bt = 0.07 + 0.13 * rise;
  const bb = 0.065 + 0.035 * rise;
  const yc = 0.07 + 0.42 * rise;
  const stemTop = yc - bb * 0.4;
  const spread = 0.1 + 0.5 * ease((tau - 0.1) / 2) + 0.012 * tau;
  const hs = 0.045 + 0.03 * rise;
  const ring = ease((tau - 0.6) / 1.2);
  const ringY = 0.2 + 0.07 * ring;
  const ringX = 0.05 + 0.085 * ring;
  const shockR = 0.1 + 1.6 * tau;
  const shock = 1 - sat(tau / 1.1);
  // Fogonazo: la pantalla quemada (más en la zona cero) que se apaga a tramas.
  const flash = 0.95 * (1 - sat((tau - 0.06) / 0.42)) ** 1.6;
  // Halo ceñido de la bola de fuego, solo mientras está al rojo (luego dejaría un disco de trama alrededor).
  const halo = 1.2 * Math.max(0, heat - 0.5);
  // Las bolas del sombrero ruedan: cada mitad gira hacia fuera por arriba (el anillo de vórtice).
  const spin = tau * 0.35;
  const cosS = Math.cos(spin);
  const sinS = Math.sin(spin);
  const kc = 12 / (0.5 + 0.5 * rise);
  const capX = a * 1.23;
  const line = 1 / unit;

  // Lo que solo depende de la columna (con margen para las filas que se van de lado): borde del polvo y pliegue.
  for (let c = 0; c < dust.length; c++) {
    const x = (c - MARGIN - pw / 2) / unit;
    dust[c] = 0.3 * (noise(x * 9 + 4, tau * 0.25) - 0.5);
    fold[c] = 0.6 + 0.4 * noise((x / a) * 5 + 2, tau * 0.6);
  }

  // Desgarro de la señal tras el estallido (bloques de filas que se van de lado) y barra de barrido que corre una fila.
  const tear = 1 - sat(tau / 0.5);
  const rollTop = ((-30 + 134 * ((ms % ROLL_MS) / ROLL_MS)) / 100) * ph;
  for (let j = 0; j < ph; j++) {
    const y = (gj - j) / unit;
    let off = 0;
    if (tear > 0) {
      const band = j >> 2;
      off = Math.round(
        (Math.sin(j * 0.35 + f * 2.1) * 1.5 + (hash(band, f) > 0.72 ? (hash(f, band) - 0.5) * 36 : 0)) * tear,
      );
    }
    if (j > rollTop + 0.14 * ph && j < rollTop + 0.24 * ph) off += 1;
    // Sincronía floja: de vez en cuando una franja de filas tiembla un píxel.
    if (hash(f, j >> 3) > 0.95) off += hash(j >> 3, f) > 0.5 ? 1 : -1;

    // Lo que solo depende de la fila: suelo, ancho del tallo y qué piezas pueden tocarla.
    const ground = y < 0 ? (y > -line ? 0.42 : y > -2 * line ? 0.1 : 0) : -1;
    let wd = 0;
    if (y >= 0 && y < stemTop && rise > 0.01) {
      const yy = y / stemTop;
      wd =
        (0.048 + 0.075 * (1 - yy) ** 3 + 0.07 * smooth(0.72, 1, yy) ** 2) *
        (0.4 + 0.6 * rise) *
        (1 + 0.1 * (noise(y * 16 - tau * 2.5, 3.1) - 0.5));
    }
    const baseRow = y >= 0 && y < hs * 2.1;
    const ringNy = (y - ringY) / 0.028;
    const ringRow = ring > 0 && ringNy > -1.3 && ringNy < 1.3;
    const dy = y - yc;
    const haloRow = halo > 0 ? halo * Math.exp(-((dy / (bt * 1.5)) ** 2)) : 0;
    const capRow = dy > -bb * 1.3 && dy < bt * 1.35;

    const row = j * pw;
    const bj = (j & 3) << 2;
    for (let i = 0; i < pw; i++) {
      const c = Math.min(dust.length - 1, Math.max(0, i - off + MARGIN));
      const x = (i - off - pw / 2) / unit;
      const burn = flash > 0 ? flash * (0.5 + 0.5 * Math.exp(-(x * x + y * y) * 4)) : 0;
      let v = 0;
      if (ground >= 0) v = Math.max(ground, burn * 0.8);
      else {
        // Sierra lejana, apagada, con la cresta un poco más clara.
        const rd = ridge[c]!;
        if (y < rd) v = y > rd - 1.5 * line ? 0.26 : 0.1;
        if (haloRow > 0.004) v += haloRow * Math.exp(-((x / (a * 1.25)) ** 2));

        // Tallo: columna gruesa que sube, iluminada por la izquierda y con vetas que trepan.
        const ux = x / wd;
        if (wd > 0 && ux > -1 && ux < 1) {
          const nz = Math.sqrt(1 - ux * ux);
          const lam = Math.max(0, ux * LX + nz * LZ);
          const streak = noise(ux * 2.2 + 40, y * 12 - tau * 3.2);
          const vs = (0.15 + 0.85 * lam) * (0.62 + 0.45 * streak) * 0.85 + heat * 0.3 * nz;
          v += (vs - v) * smooth(1, 0.82, Math.abs(ux)) * smooth(0, 0.2, rise);
        }

        // Polvo que se abre por el suelo: cúpula baja y ancha, más alta junto al tallo y delante de su pie.
        if (baseRow && x < spread * 1.15 && x > -spread * 1.15) {
          const nx = x / spread;
          const ny = y / (hs * (1 + 0.7 * Math.exp(-((x / 0.13) ** 2))));
          const rr = nx * nx + ny * ny;
          if (rr < 1.4) {
            const d = puff(x * 24 + 3.3, y * 24 - tau * 0.3);
            const surf = 1 - Math.sqrt(rr) + dust[c]! + 0.1 * Math.max(0, 1 - d / RP) - 0.04;
            if (surf > 0) {
              const mz = Math.sqrt(Math.max(0, 1 - rr));
              const macro = Math.max(0, nx * 0.5 * LX + ny * LY + mz * LZ);
              const vb = (0.15 + 0.85 * macro) * (0.62 + 0.35 * lambert(d, PX, PY)) * 0.72 + heat * 0.2;
              v += (vb - v) * smooth(0, 0.05, surf);
            }
          }
        }

        // Anillo de condensación: una rosca chata y deshilachada de humo alrededor del tallo.
        if (ringRow) {
          const nx = x / ringX;
          const rr = nx * nx + ringNy * ringNy;
          if (rr < 1.6) {
            const d = puff(x * 30 + 1.7, y * 30 - tau * 0.4);
            const surf = 1 - Math.sqrt(rr) + 0.35 * Math.max(0, 1 - d / RP) - 0.16;
            if (surf > 0) {
              const vr = (0.2 + 0.8 * Math.max(0, ringNy * LY + Math.sqrt(Math.max(0, 1 - rr)) * LZ)) * 0.82;
              v += (vr - v) * smooth(0, 0.08, surf) * ring;
            }
          }
        }

        // Sombrero: cúpula de humo con la falda caída por fuera, bolas grandes y coliflor encima, y el fuego dentro.
        if (capRow && x > -capX && x < capX) {
          const pxn = x / a;
          const pyn = dy / (dy > 0 ? bt : bb * (0.6 + 0.4 * Math.min(1, pxn * pxn)));
          const rr = pxn * pxn + pyn * pyn;
          if (rr < 1.5) {
            const side = x < 0 ? -1 : 1;
            const sn = side * sinS;
            const rx = x - side * 0.55 * a;
            const ry = dy + 0.25 * bb;
            const ux = rx * cosS - ry * sn;
            const uy = rx * sn + ry * cosS;
            // Las bolas grandes hacen la silueta y el volumen; las pequeñas, la coliflor. Las normales se devuelven a
            // la pantalla (el muestreo iba girado).
            const d0 = puff(ux * kc * 0.45 + side * 3.1 + 20, uy * kc * 0.45 + 2.2);
            const b0 = lambert(d0, PX * cosS + PY * sn, -PX * sn + PY * cosS);
            const d1 = puff(ux * kc + side * 11.3, uy * kc + 5.7);
            const b1 = lambert(d1, PX * cosS + PY * sn, -PX * sn + PY * cosS);
            const surf =
              1 - Math.sqrt(rr) + 0.16 * Math.max(0, 1 - d0 / RP) + 0.09 * Math.max(0, 1 - d1 / RP) - 0.12;
            if (surf > 0) {
              const mz = Math.sqrt(Math.max(0, 1 - rr));
              const macro = Math.max(0, pxn * 0.7 * LX + pyn * 0.9 * LY + mz * LZ);
              // Pliegue en sombra entre la cúpula y la rosca que se enrolla por debajo (sigue la caída de la falda).
              const crease = Math.exp(-(((pyn + 0.15 - 0.3 * pxn * pxn) / 0.18) ** 2)) * fold[c]!;
              // El fuego que aún arde dentro asoma por abajo, donde entra el tallo.
              const core = Math.exp(-(pxn * pxn * 4.5) - (pyn + 0.75) ** 2 * 5);
              // El blanco quemado queda para el fuego: lo iluminado por fuera no pasa del verde vivo.
              const vc =
                (0.06 + 0.94 * macro) * (0.58 + 0.22 * b0 + 0.22 * b1) * (1 - 0.6 * crease) * 0.84 +
                core * (0.5 + 0.6 * heat) +
                heat * 0.3;
              v += (vc - v) * smooth(0, 0.035, surf);
            }
          }
        }

        // Frente de choque: una raya fina que se va de la pantalla, con la cúpula de condensación detrás.
        if (shock > 0) {
          const dd = (Math.sqrt(x * x + y * y) - shockR) * unit;
          if (dd > -4 && dd < 4) v = Math.max(v, Math.exp(-(dd * dd) / 1.5) * shock * 0.95);
          if (dd < 0) v += 0.1 * shock;
        }
        v = Math.max(v, burn);
      }

      // Por debajo de un mínimo, negro: si no, la trama siembra el cielo de puntitos en rejilla.
      let q = v < 0.04 ? 0 : Math.min(TOP, (v * TOP + BAYER[bj + ((i - off) & 3)]!) | 0);
      if (trail) q = Math.max(q, lv[row + i]! - DECAY);
      lv[row + i] = q;
      px[row + i] = PALETTE[q]!;
    }
  }

  // Ceniza que cae, cuando el hongo ya está hecho: motas sueltas que bajan despacio y se mecen.
  const ash = sat((tau - 1.2) / 1.2);
  for (let k = 0; ash > 0 && k < ASH; k++) {
    if (hash(k, 4) > ash) continue;
    const i = Math.round(hash(k, 1) * pw + Math.sin(tau * 1.3 + k) * 2);
    const j = Math.floor(((hash(k, 3) + tau * (0.03 + 0.04 * hash(k, 2))) % 1) * gj);
    if (i >= 0 && i < pw) px[j * pw + i] = PALETTE[hash(k, 5) > 0.8 ? 4 : 3]!;
  }
  ctx.putImageData(g.img!, 0, 0);
}

const sat = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (v: number): number => 1 - (1 - sat(v)) ** 3;
const smooth = (e0: number, e1: number, v: number): number => {
  const t = sat((v - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const pad = (n: number): string => String(n).padStart(2, '0');

/** Hash entero de dos enteros → [0, 1). */
function hash(x: number, y: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Ruido de valor suave en [0, 1]. */
function noise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const u = x - xi;
  const v = y - yi;
  const su = u * u * (3 - 2 * u);
  const sv = v * v * (3 - 2 * v);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
}

/** Desplazamiento al centro de la bola de humo más cercana (lo deja `puff`). */
let PX = 0;
let PY = 0;

/** Worley: distancia a la bola de humo más cercana (centros repartidos sin amontonarse); deja su desplazamiento. */
function puff(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let best = 9;
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const cx = xi + i;
      const cy = yi + j;
      const dx = cx + 0.15 + 0.7 * hash(cx, cy) - x;
      const dy = cy + 0.15 + 0.7 * hash(cy + 71, cx + 13) - y;
      const d = dx * dx + dy * dy;
      if (d < best) {
        best = d;
        PX = dx;
        PY = dy;
      }
    }
  return Math.sqrt(best);
}

/** Luz sobre la bola de humo a distancia `d` de su centro (desplazamiento al centro dx, dy): una esfera mate. */
function lambert(d: number, dx: number, dy: number): number {
  if (d >= RP) return 0;
  const nz = Math.sqrt(RP * RP - d * d) / RP;
  return Math.max(0, (-dx / RP) * LX + (-dy / RP) * LY + nz * LZ);
}
