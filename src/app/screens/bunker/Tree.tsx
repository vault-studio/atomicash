// Árbol de pasivas (dossier §8–9): nodos unidos al centro que se compran con cupones. Vale para todo el plantel.
// Se dibuja como una pantalla de radar con las tres ramas en su color; cada nodo lleva el dibujo de lo que da y el
// panel de al lado enseña el elegido, cuánto llevas de cada rama y la suma de todo lo aprendido.
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { TREE, TREE_IDS, TREE_ROOT, type TreeNode, type TreeNodeId } from '../../../config/tree';
import { allocateNode, canAllocate, resetTree, treeCost } from '../../../meta/actions';
import { useSave } from '../../../store/save';
import { pickupIcon, treeIcon } from '../../icons';
import { Screen } from './common';

/** Radio de cada tamaño de nodo, en unidades del dibujo (0–100). */
const R = { small: 3.4, big: 4.8, unique: 5.8, root: 4.7 } as const;

type Branch = 'combat' | 'survival' | 'scrap' | 'bridge' | 'root';
const BRANCHES = ['combat', 'survival', 'scrap'] as const;
/** Ángulo de cada rama en el dibujo (el mismo que en config/tree.ts). */
const BRANCH_ANGLE = { combat: -90, survival: 150, scrap: 30 } as const;
const BRANCH_COLOR: Readonly<Record<Branch, string>> = {
  combat: '#ff6a3a',
  survival: '#3cff6b',
  scrap: '#ffc83a',
  bridge: '#f3e9d2',
  root: '#3cff6b',
};

/** Rama de un nodo por su ID (c…, s…, k…, b… puente). */
function branchOf(id: TreeNodeId): Branch {
  if (id === TREE_ROOT) return 'root';
  return ({ c: 'combat', s: 'survival', k: 'scrap' } as const)[id[0] as 'c' | 's' | 'k'] ?? 'bridge';
}

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

const RINGS = [0.18, 0.34, 0.5, 0.66, 0.8, 0.96];
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

/** Texto del efecto de un nodo (con `v` para sumar varios). */
export function useNodeEffect(): (n: TreeNode, v?: number) => string {
  const { t } = useTranslation();
  return (n, v = n.v) =>
    n.stat ? t(`tree.stat.${n.stat}`, { v }) : n.mod ? t(`tree.mod.${n.mod}`, { v }) : '';
}

export function Tree({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const data = useSave((s) => s.data);
  const act = useSave((s) => s.act);
  const effect = useNodeEffect();
  const [sel, setSel] = useState<TreeNodeId>(TREE_ROOT);
  const [confirm, setConfirm] = useState(false);
  const { svgRef, viewBox, zoom, zoomIn, zoomOut, reset, dragged, handlers } = useMapZoom();
  const owned = new Set<TreeNodeId>([TREE_ROOT, ...data.tree.nodes]);
  const credits = data.profile.credits;

  // Cada unión una sola vez.
  const edges: [TreeNodeId, TreeNodeId][] = [];
  for (const a of TREE_IDS) for (const b of TREE[a].links as readonly TreeNodeId[]) edges.push([a, b]);

  const nameOf = (id: TreeNodeId): string => {
    const n: TreeNode = TREE[id];
    if (id === TREE_ROOT) return t('tree.root');
    return n.stat ? t(`tree.statName.${n.stat}`) : t(`tree.name.${n.mod ?? ''}`);
  };

  // Suma de lo aprendido, agrupado por efecto, en el orden del árbol.
  const bonuses = new Map<string, { node: TreeNode; v: number }>();
  for (const id of TREE_IDS) {
    if (id === TREE_ROOT || !owned.has(id)) continue;
    const n: TreeNode = TREE[id];
    const key = n.stat ?? n.mod ?? '';
    const b = bonuses.get(key);
    if (b) b.v = Math.round((b.v + n.v) * 100) / 100;
    else bonuses.set(key, { node: n, v: n.v });
  }

  const node: TreeNode = TREE[sel];
  const branch = branchOf(sel);
  const cost = treeCost(data, sel);
  const open = canAllocate(data, sel);

  return (
    <Screen title={t('bunker.tree.cmd')} onBack={onBack}>
      <p className="tree__intro">{t('tree.intro', { n: data.tree.nodes.length })}</p>
      <div className="tree">
        <div className="tree__stage">
          <svg
            ref={svgRef}
            className={zoom > 1.01 ? 'tree__map is-zoomed' : 'tree__map'}
            viewBox={viewBox}
            role="group"
            aria-label={t('bunker.tree.cmd')}
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
            {BRANCHES.map((b) => (
              <path key={b} d={wedge(BRANCH_ANGLE[b])} fill={BRANCH_COLOR[b]} className="tree__wedge" />
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
            {/* Nombre de cada rama junto a su única: encima la de arriba, debajo las otras dos. */}
            {BRANCHES.map((b) => {
              const [x, y] = polar(BRANCH_ANGLE[b], 0.96);
              return (
                <text
                  key={b}
                  x={x}
                  y={b === 'combat' ? y - 8.6 : y + 10.4}
                  className="tree__label"
                  fill={BRANCH_COLOR[b]}
                >
                  {t(`tree.branch.${b}`)}
                </text>
              );
            })}

            {/* Uniones: apagadas, a tiro (una punta aprendida) o encendidas con la energía corriendo. */}
            {edges.map(([a, b]) => {
              const on = owned.has(a) && owned.has(b);
              const near = owned.has(a) || owned.has(b);
              const far = branchOf(b) === 'bridge' || branchOf(b) === 'root' ? a : b;
              const c = BRANCH_COLOR[branchOf(far)];
              const line = { x1: TREE[a].x, y1: TREE[a].y, x2: TREE[b].x, y2: TREE[b].y };
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
              const n: TreeNode = TREE[id];
              const has = owned.has(id);
              const can = !has && canAllocate(data, id);
              const r = id === TREE_ROOT ? R.root : R[n.size];
              const cls = [
                'tree__node',
                `is-${id === TREE_ROOT ? 'root' : n.size}`,
                has
                  ? 'is-owned'
                  : can
                    ? credits >= treeCost(data, id)
                      ? 'is-open'
                      : 'is-poor'
                    : 'is-locked',
                sel === id ? 'is-sel' : '',
              ].join(' ');
              return (
                <g
                  key={id}
                  className={cls}
                  style={colorVar(BRANCH_COLOR[branchOf(id)])}
                  transform={`translate(${n.x} ${n.y})`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${nameOf(id)}: ${id === TREE_ROOT ? t('tree.rootDesc') : effect(n)}`}
                  onClick={() => {
                    if (!dragged()) setSel(id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setSel(id);
                  }}
                >
                  {can && <circle r={r + 1.8} className="tree__halo" />}
                  {n.size === 'unique' && <circle r={r + 1.3} className="tree__crown" />}
                  <circle r={r} className="tree__base" />
                  <image
                    href={treeIcon(n)}
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
          <section className={`tree__card is-${branch}`} style={colorVar(BRANCH_COLOR[branch])}>
            <div className="tree__card-head">
              <img className="tree__card-icon" src={treeIcon(node)} alt="" />
              <div>
                <small className="tree__card-branch">
                  {t(`tree.branch.${branch}`)}
                  {sel !== TREE_ROOT && <> · {t(`tree.size.${node.size}`)}</>}
                </small>
                <strong className="tree__card-name">{nameOf(sel)}</strong>
              </div>
            </div>
            <p className="tree__card-fx">{sel === TREE_ROOT ? t('tree.rootDesc') : effect(node)}</p>
            {sel === TREE_ROOT ? null : owned.has(sel) ? (
              <p className="tree__card-state">✔ {t('tree.owned')}</p>
            ) : (
              <>
                <button
                  className="btn btn--primary tree__buy"
                  disabled={!open || credits < cost}
                  onClick={() => act((d) => allocateNode(d, sel))}
                >
                  {open ? (
                    <>
                      {t('tree.learn')} <img src={pickupIcon('coupon')} alt="" /> {cost.toLocaleString()}
                    </>
                  ) : (
                    t('tree.locked')
                  )}
                </button>
                {!open && <small>{t('tree.needs')}</small>}
              </>
            )}
          </section>

          <section className="tree__branches">
            {BRANCHES.map((b) => {
              const ids = TREE_IDS.filter((id) => branchOf(id) === b);
              const got = ids.filter((id) => owned.has(id)).length;
              return (
                <div key={b} className="tree__branch" style={colorVar(BRANCH_COLOR[b])}>
                  <span>{t(`tree.branch.${b}`)}</span>
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
                {[...bonuses.values()].map(({ node: n, v }) => (
                  <li key={n.stat ?? n.mod}>
                    <img src={treeIcon(n)} alt="" />
                    {effect(n, v)}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <footer className="tree__foot">
            <small>{t('tree.spent', { n: data.tree.spent })}</small>
            {confirm ? (
              <div className="tree__confirm">
                <span>{t('tree.resetAsk', { n: data.tree.spent })}</span>
                <button
                  className="btn"
                  onClick={() => {
                    act((d) => resetTree(d));
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
              <button
                className="btn"
                disabled={data.tree.nodes.length === 0}
                onClick={() => setConfirm(true)}
              >
                {t('tree.reset')}
              </button>
            )}
          </footer>
        </aside>
      </div>
    </Screen>
  );
}
