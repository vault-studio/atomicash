// Árbol de un superviviente (dossier §8–9): nodos unidos al centro que se aprenden con puntos (1 por nodo). Va
// dentro de su ficha. Se dibuja como una pantalla de radar con las tres ramas en su color; cada nodo lleva el dibujo
// de lo que da y el panel de al lado enseña el elegido, cuánto llevas de cada rama y la suma de todo lo aprendido.
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { SURVIVOR_LEVEL, STARS } from '../../../config/meta';
import { SURVIVORS, type RosterId } from '../../../config/survivors';
import {
  TREES,
  TREE_FX,
  TREE_IDS,
  TREE_POINTS,
  TREE_ROOT,
  treeNeighbors,
  treePointsFor,
  type NodeGain,
  type TreeNode,
  type TreeNodeId,
} from '../../../config/tree';
import {
  allocateNode,
  canAllocate,
  canRefund,
  refundNode,
  resetTree,
  treeFree,
  treePoints,
} from '../../../meta/actions';
import { useSave } from '../../../store/save';
import { treeIcon } from '../../icons';

/** Radio de cada tamaño de nodo, en unidades del dibujo (0–100). */
const R = { small: 3, big: 4, unique: 5, root: 4.2 } as const;

type Branch = TreeNode['branch'];
/** Cuñas del fondo: Radiación arriba, Pasiva abajo a la izquierda y Oficio abajo a la derecha. */
const WEDGES = [
  { b: 'r', angle: -90 },
  { b: 'p', angle: 150 },
  { b: 'l', angle: 30 },
] as const;
const BRANCH_COLOR: Readonly<Record<Branch, string>> = {
  r: '#3cff6b',
  ra: '#9fb3c0',
  rb: '#c8ff00',
  p: '#ff6a3a',
  l: '#ffc83a',
  m: '#f3e9d2',
  root: '#3cff6b',
};
/** Filas de progreso por rama: qué ramas del árbol cuentan en cada una. */
const PROGRESS: readonly { key: 'rad' | 'p' | 'l' | 'mixed'; branches: readonly Branch[]; color: Branch }[] =
  [
    { key: 'rad', branches: ['r', 'ra', 'rb'], color: 'r' },
    { key: 'p', branches: ['p'], color: 'p' },
    { key: 'l', branches: ['l'], color: 'l' },
    { key: 'mixed', branches: ['m'], color: 'm' },
  ];

/** Punto a `d` (0–1) del centro en el ángulo `deg`, como `at` de config/tree.ts. */
function polar(deg: number, d: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [50 + Math.cos(a) * d * 46, 50 + Math.sin(a) * d * 46];
}

/** Cuña de una rama (±60° alrededor de su ángulo) para teñir el fondo. */
function wedge(deg: number): string {
  const [x1, y1] = polar(deg - 60, 1.08);
  const [x2, y2] = polar(deg + 60, 1.08);
  const r = 46 * 1.08;
  return `M50 50 L${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2} Z`;
}

const RINGS = [0.17, 0.3, 0.43, 0.56, 0.69, 0.81, 0.95];
const colorVar = (c: string): CSSProperties => ({ '--c': c }) as CSSProperties;

/** Encuadre completo del dibujo y zoom máximo. */
const VIEW = { x: -6, y: -7, w: 112 } as const;
const MAX_ZOOM = 4;
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
function useMapZoom() {
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

/** Texto del efecto de una ganancia (con `v` para sumar varias del mismo efecto). */
export function useGainEffect(): (g: NodeGain, v?: number) => string {
  const { t } = useTranslation();
  const vars = { high: TREE_FX.highRad, to: TREE_FX.saveTo, dur: TREE_FX.rushDur };
  return (g, v = g.v) =>
    g.stat ? t(`tree.stat.${g.stat}`, { v, ...vars }) : g.mod ? t(`tree.mod.${g.mod}`, { v, ...vars }) : '';
}

export function Tree({ charId }: { charId: RosterId }) {
  const { t } = useTranslation();
  const data = useSave((s) => s.data);
  const act = useSave((s) => s.act);
  const effect = useGainEffect();
  const [sel, setSel] = useState<TreeNodeId>(TREE_ROOT);
  const [confirm, setConfirm] = useState(false);
  const { svgRef, viewBox, zoom, zoomIn, zoomOut, reset, dragged, handlers } = useMapZoom();
  const tree = TREES[charId];
  const me = data.survivors[charId];
  const bought = me?.tree ?? [];
  const owned = new Set<TreeNodeId>([TREE_ROOT, ...bought]);
  const free = me ? treeFree(me) : 0;
  const total = me ? treePoints(me) : 0;
  const maxPoints = treePointsFor(SURVIVOR_LEVEL.max, STARS.max);
  const starter = me?.starter ?? SURVIVORS[charId].weapon;

  // Cada unión una sola vez.
  const edges: [TreeNodeId, TreeNodeId][] = [];
  for (const a of TREE_IDS) for (const b of tree[a].links as readonly TreeNodeId[]) edges.push([a, b]);

  const nameOf = (id: TreeNodeId): string => {
    const n: TreeNode = tree[id];
    if (id === TREE_ROOT) return t('tree.root');
    return n.branch === 'r' || n.branch === 'ra' || n.branch === 'rb'
      ? t(`tree.node.rad.${id}`)
      : t(`tree.node.${charId}.${id}`);
  };
  const branchName = (b: Branch): string => {
    if (b === 'root') return t('tree.branch.root');
    if (b === 'm') return t('tree.branch.mixed');
    if (b === 'p' || b === 'l') return t(`tree.branch.${charId}.${b}`);
    return t(b === 'r' ? 'tree.branch.rad' : `tree.branch.${b}`);
  };
  const effectsOf = (n: TreeNode): string => n.gains.map((g) => effect(g)).join(' · ');
  /** Unido a un nodo aprendido (o al centro), tenga o no punto libre. */
  const linked = (id: TreeNodeId): boolean => treeNeighbors(id).some((k) => owned.has(k));

  // Suma de lo aprendido, agrupado por stat o mod, en el orden del árbol.
  const bonuses = new Map<string, { gain: NodeGain; v: number }>();
  for (const id of TREE_IDS) {
    if (id === TREE_ROOT || !owned.has(id)) continue;
    for (const g of tree[id].gains) {
      const key = g.stat ? `s:${g.stat}` : `m:${g.mod ?? ''}`;
      const b = bonuses.get(key);
      if (b) b.v = Math.round((b.v + g.v) * 100) / 100;
      else bonuses.set(key, { gain: g, v: g.v });
    }
  }

  const node: TreeNode = tree[sel];
  const branch = node.branch;
  const has = owned.has(sel);
  const open = canAllocate(data, charId, sel);
  const canBack = canRefund(data, charId, sel);

  return (
    <>
      <div className="tree">
        <div className="tree__stage">
          <svg
            ref={svgRef}
            className={zoom > 1.01 ? 'tree__map is-zoomed' : 'tree__map'}
            viewBox={viewBox}
            role="group"
            aria-label={t('sheet.tabTree')}
            {...handlers}
          >
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
            {/* Uniones: apagadas, a tiro (una punta aprendida) o encendidas con la energía corriendo. */}
            {edges.map(([a, b]) => {
              const on = owned.has(a) && owned.has(b);
              const near = owned.has(a) || owned.has(b);
              const far = tree[b].branch === 'm' || tree[b].branch === 'root' ? a : b;
              const c = BRANCH_COLOR[tree[far].branch];
              const line = { x1: tree[a].x, y1: tree[a].y, x2: tree[b].x, y2: tree[b].y };
              return (
                <g
                  key={`${a}-${b}`}
                  className={`tree__edge ${on ? 'is-on' : near ? 'is-near' : ''}`}
                  style={colorVar(c)}
                >
                  <line {...line} className="tree__wire" />
                  {on && <line {...line} className="tree__flow" />}
                </g>
              );
            })}

            {TREE_IDS.map((id) => {
              const n: TreeNode = tree[id];
              const got = owned.has(id);
              const can = !got && canAllocate(data, charId, id);
              const r = id === TREE_ROOT ? R.root : R[n.size];
              const cls = [
                'tree__node',
                `is-${id === TREE_ROOT ? 'root' : n.size}`,
                got ? 'is-owned' : can ? 'is-open' : linked(id) ? 'is-poor' : 'is-locked',
                sel === id ? 'is-sel' : '',
              ].join(' ');
              return (
                <g
                  key={id}
                  className={cls}
                  style={colorVar(BRANCH_COLOR[n.branch])}
                  transform={`translate(${n.x} ${n.y})`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${nameOf(id)}: ${id === TREE_ROOT ? t('tree.rootDesc') : effectsOf(n)}`}
                  onClick={() => {
                    if (!dragged()) setSel(id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setSel(id);
                  }}
                >
                  <circle r={r + 1.4} className="tree__hit" />
                  {can && <circle r={r + 1.8} className="tree__halo" />}
                  {n.size === 'unique' && <circle r={r + 1.3} className="tree__crown" />}
                  <circle r={r} className="tree__base" />
                  <image
                    href={treeIcon(n, starter)}
                    x={-r}
                    y={-r}
                    width={r * 2}
                    height={r * 2}
                    clipPath="url(#tree-clip)"
                    preserveAspectRatio="xMidYMid slice"
                    className="tree__icon"
                  />
                  <circle r={r} className="tree__rim" />
                  {n.size === 'big' && <circle r={r - 0.9} className="tree__inner" />}
                </g>
              );
            })}
          </svg>
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
        </div>

        <aside className="tree__panel">
          <p className="tree__shards">{t('tree.points', { free, total })}</p>
          <section className={`tree__card is-${branch}`} style={colorVar(BRANCH_COLOR[branch])}>
            <div className="tree__card-head">
              <img className="tree__card-icon" src={treeIcon(node, starter)} alt="" />
              <div>
                <small className="tree__card-branch">
                  {branchName(branch)}
                  {sel !== TREE_ROOT && <> · {t(`tree.size.${node.size}`)}</>}
                </small>
                <strong className="tree__card-name">{nameOf(sel)}</strong>
              </div>
            </div>
            {sel === TREE_ROOT ? (
              <p className="tree__card-fx">{t('tree.rootDesc')}</p>
            ) : (
              node.gains.map((g, i) => (
                <p key={`${g.stat ?? g.mod}-${i}`} className="tree__card-fx">
                  {effect(g)}
                </p>
              ))
            )}
            {sel === TREE_ROOT ? null : has ? (
              <>
                <button
                  className="btn tree__buy"
                  disabled={!canBack}
                  onClick={() => act((d) => refundNode(d, charId, sel))}
                >
                  {t('tree.refund')}
                </button>
                {!canBack && <small>{t('tree.refundBlocked')}</small>}
              </>
            ) : (
              <>
                <button
                  className="btn btn--primary tree__buy"
                  disabled={!open}
                  onClick={() => act((d) => allocateNode(d, charId, sel))}
                >
                  {t('tree.learn')}
                </button>
                {!open && <small>{free < 1 ? t('tree.noPoints') : t('tree.needs')}</small>}
              </>
            )}
          </section>

          <section className="tree__branches">
            {PROGRESS.map((row) => {
              const ids = TREE_IDS.filter((id) => row.branches.includes(tree[id].branch));
              const got = ids.filter((id) => owned.has(id)).length;
              return (
                <div key={row.key} className="tree__branch" style={colorVar(BRANCH_COLOR[row.color])}>
                  <span>
                    {row.key === 'rad'
                      ? t('tree.branch.rad')
                      : row.key === 'mixed'
                        ? t('tree.branch.mixed')
                        : t(`tree.branch.${charId}.${row.key}`)}
                  </span>
                  <span className="tree__branch-bar">
                    <span style={{ width: `${(got / ids.length) * 100}%` }} />
                  </span>
                  <b>
                    {got}/{ids.length}
                  </b>
                </div>
              );
            })}
          </section>

          <section className="tree__bonuses">
            <h3>{t('tree.bonuses')}</h3>
            {bonuses.size === 0 ? (
              <p>{t('tree.noBonuses')}</p>
            ) : (
              <ul>
                {[...bonuses.entries()].map(([key, { gain, v }]) => (
                  <li key={key}>
                    <img src={treeIcon({ gains: [gain] }, starter)} alt="" />
                    {effect(gain, v)}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <small className="tree__help">
            {t('tree.pointsHelp', { every: TREE_POINTS.levelEvery, max: maxPoints })}
          </small>

          <footer className="tree__foot">
            {confirm ? (
              <div className="tree__confirm">
                <span>{t('tree.resetAsk')}</span>
                <button
                  className="btn"
                  onClick={() => {
                    act((d) => resetTree(d, charId));
                    setConfirm(false);
                  }}
                >
                  {t('tree.resetYes')}
                </button>
                <button className="btn" onClick={() => setConfirm(false)}>
                  {t('tree.resetNo')}
                </button>
              </div>
            ) : (
              <button className="btn" disabled={bought.length === 0} onClick={() => setConfirm(true)}>
                {t('tree.reset')}
              </button>
            )}
          </footer>
        </aside>
      </div>
    </>
  );
}
