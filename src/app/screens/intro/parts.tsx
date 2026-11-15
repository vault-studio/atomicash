// Piezas de la intro: píxeles, texto tecleado, filtros de rasgado, logo y bomba.
import { type CSSProperties } from 'react';
import { CLOUD_A, CLOUD_AT, CLOUD_B, FRAMES, WAVES, timing } from './cloud';
import { BOMB, HEIGHT, LETTERS, WIDTH } from './glyphs';
import type { Tones } from './pixels';

// ---------- Piezas ----------

/** Un fotograma de píxeles: un `path` por tono. */
function Pixels({ tones }: { tones: Tones }) {
  return <>{tones.map((d, k) => (d ? <path key={k} className={`intro__tone${k + 1}`} d={d} /> : null))}</>;
}

/** Texto a máquina: VT323 es monoespaciada, así que el ancho en ch avanza letra a letra. La caja de fuera ya
 *  tiene el ancho final para que el texto centrado no se mueva mientras se escribe. */
export function Typed({ text, at, className = '' }: { text: string; at: number; className?: string }) {
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
export function TearFilters() {
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
export function Logo() {
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
export function Bomb() {
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
