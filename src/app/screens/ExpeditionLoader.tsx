// Pantalla de carga de la expedición: un monitor viejo de fósforo verde que recibe la emisión de una prueba nuclear.
// El hongo se pinta píxel a píxel en un canvas diminuto (tramado ordenado, seis tonos de fósforo que tardan en
// apagarse) que el navegador amplía sin suavizar, a 12 fotogramas por segundo, como los juegos de cinta del aparato de
// muñeca. El tubo (sacudida, destello, nieve, parpadeo, barra de barrido y líneas) va en CSS (styles/loader/). El reloj
// del dibujo es una animación CSS de relleno: así todo se congela y se inspecciona a la vez con document.getAnimations().
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { audio } from '../../audio/audio';
import { noise, smooth } from './loader/noise';
import { paint, readouts } from './loader/paint';

/** Fotogramas por segundo del hongo. */
export const FPS = 12;
/** Línea del suelo, en fracción del alto desde arriba (debajo va el texto). */
const GROUND = 0.79;
/** Periodo de la barra de barrido (cuadra con load-roll en styles/loader/frames.css). */
export const ROLL_MS = 3600;
/** Fotograma fijo con movimiento reducido: el hongo ya formado. */
const STILL_FRAME = 30;
/** Seis tonos de fósforo, de nada a quemado, en RGBA empaquetado (little-endian) para escribir de golpe. */
export const PALETTE = [
  [0, 0, 0, 0],
  [8, 44, 20, 255],
  [18, 96, 42, 255],
  [36, 172, 72, 255],
  [60, 255, 107, 255],
  [214, 255, 224, 255],
].map(([r = 0, g = 0, b = 0, a = 0]) => ((a << 24) | (b << 16) | (g << 8) | r) >>> 0);
export const TOP = PALETTE.length - 1;
/** Tonos que pierde por fotograma lo que se apaga (la estela del fósforo). */
export const DECAY = 2;
/** Umbrales del tramado ordenado (Bayer 4×4). */
export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((n) => (n + 0.5) / 16);
/** Luz de arriba, algo a la izquierda y de frente (vector unitario). */
export const LX = -0.3;
export const LY = 0.6;
export const LZ = 0.74;
/** Radio de cada bola de humo dentro de su celda de Worley. */
export const RP = 0.6;
/** Motas de ceniza que caen. */
export const ASH = 55;
/** Columnas de sobra a cada lado de las tablas por columna, para las filas que el desgarro mueve de lado. */
export const MARGIN = 24;

/** Lado del píxel del dibujo en px CSS: múltiplo de 3 para caer justo en las líneas del filtro CRT (styles/app/ui.css). */
const pixelSize = (h: number): number => 3 * Math.max(1, Math.round(h / 420));

export interface Grid {
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
