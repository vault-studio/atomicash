// Piezas fijas del mapa del árbol: fondo del radar y botones de zoom.
import { useTranslation } from 'react-i18next';
import { BRANCH_COLOR, RINGS, WEDGES, polar, wedge } from './geometry';
import { MAX_ZOOM } from './zoom';

/** Fondo del radar: degradado, filtros, disco, cuñas de las ramas, anillos, radios y barrido (no cambia). */
export function RadarBackdrop() {
  return (
    <>
      <defs>
        <radialGradient id="tree-bg">
          <stop offset="0" stopColor="#1b3d22" />
          <stop offset="0.7" stopColor="#0b1a0e" />
          <stop offset="1" stopColor="#050b06" />
        </radialGradient>
        <filter id="tree-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.9" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id="tree-clip" clipPathUnits="objectBoundingBox">
          <circle cx="0.5" cy="0.5" r="0.5" />
        </clipPath>
      </defs>

      {/* Pantalla de radar: disco, cuñas de las ramas, anillos, radios y barrido. */}
      <circle cx="50" cy="50" r="51" fill="url(#tree-bg)" className="tree__disc" />
      {WEDGES.map((w) => (
        <path key={w.b} d={wedge(w.angle)} fill={BRANCH_COLOR[w.b]} className="tree__wedge" />
      ))}
      {RINGS.map((d) => (
        <circle key={d} cx="50" cy="50" r={d * 46} className="tree__ring" />
      ))}
      {[-90, -30, 30, 90, 150, 210].map((a) => {
        const [x, y] = polar(a, 1.08);
        return <line key={a} x1="50" y1="50" x2={x} y2={y} className="tree__spoke" />;
      })}
      <g className="tree__sweep">
        <path d={`M50 50 L50 0.3 A49.7 49.7 0 0 1 ${polar(-60, 1.08).join(' ')} Z`} />
      </g>
    </>
  );
}

/** Botones de acercar, alejar y encuadrar el mapa del árbol. */
export function TreeZoom({
  zoom,
  zoomIn,
  zoomOut,
  reset,
}: {
  zoom: number;
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="tree__zoom">
      <button
        className="tree__zoom-btn"
        onClick={zoomIn}
        disabled={zoom >= MAX_ZOOM - 0.01}
        aria-label={t('tree.zoomIn')}
      >
        +
      </button>
      <button
        className="tree__zoom-btn"
        onClick={zoomOut}
        disabled={zoom <= 1.01}
        aria-label={t('tree.zoomOut')}
      >
        −
      </button>
      <button
        className="tree__zoom-btn"
        onClick={reset}
        disabled={zoom <= 1.01}
        aria-label={t('tree.zoomReset')}
      >
        ⤢
      </button>
    </div>
  );
}
