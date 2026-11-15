// Zoom y arrastre del mapa del árbol (rueda, pellizco, botones).
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';

/** Encuadre completo del dibujo y zoom máximo. */
const VIEW = { x: -6, y: -7, w: 112 } as const;
export const MAX_ZOOM = 4;
/** Cuánto acerca cada pulsación de + / − y cada paso de la rueda. */
const ZOOM_STEP = 1.4;
const WHEEL_STEP = 1.15;
/** Píxeles que hay que arrastrar para que no cuente como toque en un nodo. */
const DRAG_PX = 6;

interface View {
  x: number;
  y: number;
  w: number;
}

/** Acerca `f` veces (alejar si < 1) dejando quieto el punto (px, py) del dibujo, sin salirse de él. */
function zoomView(v: View, f: number, px: number, py: number): View {
  const w = Math.min(VIEW.w, Math.max(VIEW.w / MAX_ZOOM, v.w / f));
  return clampView({ w, x: px - (px - v.x) * (w / v.w), y: py - (py - v.y) * (w / v.w) });
}

/** Mantiene el encuadre dentro del dibujo. */
function clampView(v: View): View {
  return {
    w: v.w,
    x: Math.min(VIEW.x + VIEW.w - v.w, Math.max(VIEW.x, v.x)),
    y: Math.min(VIEW.y + VIEW.w - v.w, Math.max(VIEW.y, v.y)),
  };
}

/**
 * Zoom del mapa cambiando el viewBox: botones, rueda del ratón (hacia el puntero), pellizco con dos dedos y arrastre
 * para moverse. `dragged()` dice si el último gesto fue un arrastre, para no elegir el nodo al soltar.
 */
export function useMapZoom() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>({ ...VIEW });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ moved: 0, pinch: 0 });

  /** Punto del dibujo bajo unas coordenadas de pantalla. */
  const toMap = useCallback((cx: number, cy: number, v: View): [number, number] => {
    // El SVG llena el hueco y el viewBox cuadrado va centrado dentro (xMidYMid meet).
    const r = svgRef.current?.getBoundingClientRect();
    if (!r || r.width === 0) return [v.x + v.w / 2, v.y + v.w / 2];
    const k = Math.min(r.width, r.height) / v.w;
    return [
      v.x + (cx - r.left - (r.width - v.w * k) / 2) / k,
      v.y + (cy - r.top - (r.height - v.w * k) / 2) / k,
    ];
  }, []);

  // La rueda necesita un listener no pasivo para que la página no haga scroll.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      const f = e.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP;
      setView((v) => zoomView(v, f, ...toMap(e.clientX, e.clientY, v)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [toMap]);

  const spread = (): number => {
    const [a, b] = [...pointers.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };

  const onPointerDown = (e: PointerEvent<SVGSVGElement>): void => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) gesture.current.moved = 0;
    gesture.current.pinch = spread();
  };

  const onPointerMove = (e: PointerEvent<SVGSVGElement>): void => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesture.current.moved += Math.abs(dx) + Math.abs(dy);
    // Solo se captura el puntero al empezar a arrastrar: así un toque sigue llegando al nodo.
    if (gesture.current.moved > DRAG_PX && !e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.setPointerCapture(e.pointerId);
    const [a, b] = [...pointers.current.values()];
    if (a && b) {
      const d = spread();
      const f = gesture.current.pinch > 0 && d > 0 ? d / gesture.current.pinch : 1;
      setView((v) => zoomView(v, f, ...toMap((a.x + b.x) / 2, (a.y + b.y) / 2, v)));
      gesture.current.pinch = d;
    } else if (gesture.current.moved > DRAG_PX) {
      const r = e.currentTarget.getBoundingClientRect();
      const px = Math.min(r.width, r.height);
      setView((v) => clampView({ ...v, x: v.x - (dx / px) * v.w, y: v.y - (dy / px) * v.w }));
    }
  };

  const onPointerUp = (e: PointerEvent<SVGSVGElement>): void => {
    pointers.current.delete(e.pointerId);
    gesture.current.pinch = spread();
  };

  const center = (v: View): [number, number] => [v.x + v.w / 2, v.y + v.w / 2];
  return {
    svgRef,
    viewBox: `${view.x} ${view.y} ${view.w} ${view.w}`,
    zoom: VIEW.w / view.w,
    zoomIn: () => setView((v) => zoomView(v, ZOOM_STEP, ...center(v))),
    zoomOut: () => setView((v) => zoomView(v, 1 / ZOOM_STEP, ...center(v))),
    reset: () => setView({ ...VIEW }),
    dragged: () => gesture.current.moved > DRAG_PX,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}
