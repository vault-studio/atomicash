// Árbol de un superviviente (dossier §8–9): nodos unidos al centro que se aprenden con puntos (1 por nodo). Va
// dentro de su ficha. Se dibuja como una pantalla de radar con las tres ramas en su color; cada nodo lleva el dibujo
// de lo que da y el panel de al lado enseña el elegido, cuánto llevas de cada rama y la suma de todo lo aprendido.
import { useState } from 'react';
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
import { BRANCH_COLOR, type Branch, PROGRESS, R, colorVar } from './tree/geometry';
import { RadarBackdrop, TreeZoom } from './tree/parts';
import { useMapZoom } from './tree/zoom';

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
            <RadarBackdrop />
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
          <TreeZoom zoom={zoom} zoomIn={zoomIn} zoomOut={zoomOut} reset={reset} />
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
