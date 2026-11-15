// Dibuja un recorte de imagen (primer frame de una hoja o imagen entera) con CSS, o un placeholder.
import type { CSSProperties } from 'react';
import type { Art, Entry } from './catalog';

/** El recorte a `scale` px de pantalla por px de imagen; con `anchored`, el punto de apoyo queda en (0, 0). */
export function ArtView({
  art,
  scale,
  flip = false,
  anchored = false,
}: {
  art: Art;
  scale: number;
  flip?: boolean;
  anchored?: boolean;
}) {
  const w = art.sw * scale;
  const h = art.sh * scale;
  const style: CSSProperties = {
    width: w,
    height: h,
    backgroundImage: `url("${art.url}")`,
    backgroundPosition: `${-art.sx * scale}px ${-art.sy * scale}px`,
    backgroundSize: `${art.imgW * scale}px ${art.imgH * scale}px`,
    backgroundRepeat: 'no-repeat',
    transformOrigin: `${art.ax * 100}% ${art.ay * 100}%`,
    transform: flip ? 'scaleX(-1)' : undefined,
  };
  if (anchored) Object.assign(style, { position: 'absolute', left: -art.ax * w, top: -art.ay * h });
  return <div className="ev-art" style={style} />;
}

/** Círculo de color con el ID: enemigo sin sprite (o imagen que no cargó). */
export function Placeholder({
  entry,
  radius,
  anchored,
}: {
  entry: Entry;
  radius: number;
  anchored?: boolean;
}) {
  const d = radius * 2;
  const style: CSSProperties = {
    width: d,
    height: d,
    background: entry.color,
    fontSize: Math.max(9, radius / 2.5),
  };
  if (anchored) Object.assign(style, { position: 'absolute', left: -radius, top: -d });
  return (
    <div className="ev-ph" style={style}>
      {entry.id.slice(0, 6)}
    </div>
  );
}

/** Miniatura de `size` px de lado para el listado. */
export function Thumb({ entry, size }: { entry: Entry; size: number }) {
  const a = entry.art;
  if (!a || !a.sw || !a.sh) return <Placeholder entry={entry} radius={size / 2 - 4} />;
  return <ArtView art={a} scale={Math.min(size / a.sw, size / a.sh)} />;
}
