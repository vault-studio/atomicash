// Mapa isométrico vacío del editor: suelo, rejilla y piezas. Arrastrar desde el listado coloca, arrastrar una pieza
// la mueve, arrastrar el fondo desplaza la vista y la rueda hace zoom alrededor del cursor.
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent,
  type WheelEvent,
} from 'react';
import { pieceCells, type EventPiece } from '../config/events';
import type { Entry } from './catalog';
import { cellAtScreen, mapHalf } from './geometry';
import { Grid, Ground } from './Ground';
import { PieceView } from './PieceView';
import { fits, useEditor, type Piece } from './state';

const ZOOM = { min: 0.08, max: 3, step: 1.15, margin: 0.92 };

interface Drag {
  uid: number;
  dx: number;
  dy: number;
  target: [number, number] | null;
}
interface Pan {
  px: number;
  py: number;
  x: number;
  y: number;
  moved: boolean;
}

/** Al soltar desde el listado, el cursor queda en el centro de los edificios de 3×3. */
const dropOffset = (e: Entry): number => (e.cells === 9 ? -1 : 0);

export function MapView({
  byKey,
  dragEntry,
}: {
  byKey: ReadonlyMap<string, Entry>;
  dragEntry: Entry | null;
}) {
  const { pieces, selected, biome, size, select, move, add } = useEditor();
  const box = useRef<HTMLDivElement>(null);
  const [cam, setCam] = useState({ x: 0, y: 0, zoom: 0.3 });
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hover, setHover] = useState<{ cells: [number, number][]; ok: boolean }>({ cells: [], ok: true });
  const pan = useRef<Pan | null>(null);
  const entryOf = (p: EventPiece) => byKey.get(`${p.type}:${p.id}`);

  /** Punto de pantalla → casilla. */
  const cellAt = useCallback(
    (cx: number, cy: number): [number, number] => {
      const r = box.current!.getBoundingClientRect();
      return cellAtScreen(
        (cx - r.left - r.width / 2 - cam.x) / cam.zoom,
        (cy - r.top - r.height / 2 - cam.y) / cam.zoom,
      );
    },
    [cam],
  );

  const fit = (): void => {
    const r = box.current!.getBoundingClientRect();
    const m = mapHalf(size);
    const zoom = Math.min(ZOOM.max, Math.min(r.width / (2 * m.w), r.height / (2 * m.h)) * ZOOM.margin);
    setCam({ x: 0, y: 0, zoom });
  };
  // Al abrir y al cambiar de tamaño, el mapa entero en la ventana.
  useLayoutEffect(fit, [size]);
  const zoomBy = (f: number, ox = 0, oy = 0): void =>
    setCam((c) => {
      const zoom = Math.min(ZOOM.max, Math.max(ZOOM.min, c.zoom * f));
      const k = zoom / c.zoom;
      return { zoom, x: ox - (ox - c.x) * k, y: oy - (oy - c.y) * k };
    });

  const onWheel = (e: WheelEvent): void => {
    const r = box.current!.getBoundingClientRect();
    zoomBy(
      e.deltaY < 0 ? ZOOM.step : 1 / ZOOM.step,
      e.clientX - r.left - r.width / 2,
      e.clientY - r.top - r.height / 2,
    );
  };

  const onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0 && e.button !== 1) return;
    box.current!.setPointerCapture(e.pointerId);
    const el = (e.target as HTMLElement).closest('[data-uid]');
    const uid = el ? Number(el.getAttribute('data-uid')) : NaN;
    const p = pieces.find((q) => q.uid === uid);
    if (p && e.button === 0) {
      const [x, y] = cellAt(e.clientX, e.clientY);
      select(p.uid);
      setDrag({ uid: p.uid, dx: p.x - x, dy: p.y - y, target: null });
    } else pan.current = { px: e.clientX, py: e.clientY, x: cam.x, y: cam.y, moved: false };
  };

  const onPointerMove = (e: PointerEvent): void => {
    const pn = pan.current;
    if (pn) {
      const dx = e.clientX - pn.px;
      const dy = e.clientY - pn.py;
      if (Math.abs(dx) + Math.abs(dy) > 3) pn.moved = true;
      setCam((c) => ({ ...c, x: pn.x + dx, y: pn.y + dy }));
    } else if (drag) {
      const [x, y] = cellAt(e.clientX, e.clientY);
      const p = pieces.find((q) => q.uid === drag.uid)!;
      const n = { ...p, x: x + drag.dx, y: y + drag.dy };
      setDrag({ ...drag, target: [n.x, n.y] });
      setHover({ cells: pieceCells(n), ok: fits(pieces, n, p.uid, size) });
    }
  };

  const onPointerUp = (): void => {
    if (pan.current && !pan.current.moved) select(null);
    pan.current = null;
    if (drag?.target) move(drag.uid, drag.target[0], drag.target[1]);
    setDrag(null);
    setHover({ cells: [], ok: true });
  };

  const onDragOver = (e: DragEvent): void => {
    if (!dragEntry) return;
    e.preventDefault();
    const [x, y] = cellAt(e.clientX, e.clientY);
    const o = dropOffset(dragEntry);
    const p = {
      type: dragEntry.type,
      id: dragEntry.id,
      x: x + o,
      y: y + o,
      flip: false,
      blocks: false,
      count: 1,
    };
    const stack = pieces.some(
      (q) => q.type === 'enemy' && p.type === 'enemy' && q.id === p.id && q.x === p.x && q.y === p.y,
    );
    setHover({ cells: pieceCells(p), ok: stack || fits(pieces, p, null, size) });
  };

  const onDrop = (e: DragEvent): void => {
    e.preventDefault();
    setHover({ cells: [], ok: true });
    if (!dragEntry) return;
    const [x, y] = cellAt(e.clientX, e.clientY);
    const o = dropOffset(dragEntry);
    add(dragEntry, x + o, y + o);
  };

  const sel = pieces.find((p) => p.uid === selected);
  const blocked = useMemo(() => pieces.filter((p) => p.blocks).flatMap((p) => pieceCells(p)), [pieces]);
  const shown: Piece[] = pieces.map((p) =>
    drag?.uid === p.uid && drag.target ? { ...p, x: drag.target[0], y: drag.target[1] } : p,
  );
  const stage = { transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.zoom})` };

  return (
    <div
      ref={box}
      className="ev-map"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDragOver={onDragOver}
      onDragLeave={() => setHover({ cells: [], ok: true })}
      onDrop={onDrop}
    >
      <div className="ev-stage" style={stage}>
        <Ground biome={biome} size={size} />
        <Grid
          size={size}
          plain={biome === 'any'}
          blocked={blocked}
          marked={sel ? pieceCells(sel) : []}
          hover={hover.cells}
          hoverOk={hover.ok}
        />
        {shown.map((p) => (
          <PieceView
            key={p.uid}
            piece={p}
            entry={entryOf(p)}
            selected={p.uid === selected}
            ghost={drag?.uid === p.uid && !hover.ok}
          />
        ))}
      </div>
      <div className="ev-zoom" onPointerDown={(e) => e.stopPropagation()}>
        <button onClick={() => zoomBy(ZOOM.step)}>+</button>
        <button onClick={() => zoomBy(1 / ZOOM.step)}>−</button>
        <button onClick={fit}>Encajar</button>
        <span>{Math.round(cam.zoom * 100)} %</span>
      </div>
    </div>
  );
}
