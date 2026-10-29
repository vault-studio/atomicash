// Árbol de pasivas (dossier §8–9): nodos unidos al centro que se compran con cupones. Vale para todo el plantel.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TREE, TREE_IDS, TREE_ROOT, type TreeNode, type TreeNodeId } from '../../../config/tree';
import { allocateNode, canAllocate, resetTree, treeCost } from '../../../meta/actions';
import { useSave } from '../../../store/save';
import { Screen } from './common';

/** Radio de cada tamaño de nodo, en unidades del dibujo (0–100). */
const R = { small: 2.6, big: 4, unique: 5 } as const;

/** Texto del efecto de un nodo. */
export function useNodeEffect(): (n: TreeNode) => string {
  const { t } = useTranslation();
  return (n) =>
    n.stat ? t(`tree.stat.${n.stat}`, { v: n.v }) : n.mod ? t(`tree.mod.${n.mod}`, { v: n.v }) : '';
}

export function Tree({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const data = useSave((s) => s.data);
  const act = useSave((s) => s.act);
  const effect = useNodeEffect();
  const [sel, setSel] = useState<TreeNodeId | null>(null);
  const [confirm, setConfirm] = useState(false);
  const owned = new Set<TreeNodeId>([TREE_ROOT, ...data.tree.nodes]);
  const credits = data.profile.credits;

  // Cada unión una sola vez.
  const edges: [TreeNodeId, TreeNodeId][] = [];
  for (const a of TREE_IDS) for (const b of TREE[a].links as readonly TreeNodeId[]) edges.push([a, b]);

  const node = sel ? TREE[sel] : null;
  const cost = sel ? treeCost(data, sel) : 0;
  const open = sel ? canAllocate(data, sel) : false;

  return (
    <Screen title={t('bunker.tree.cmd')} onBack={onBack}>
      <p>{t('tree.intro', { n: data.tree.nodes.length })}</p>
      <div className="tree">
        <svg className="tree__map" viewBox="0 0 100 100" role="group" aria-label={t('bunker.tree.cmd')}>
          {edges.map(([a, b]) => {
            const on = owned.has(a) && owned.has(b);
            const near = owned.has(a) || owned.has(b);
            return (
              <line
                key={`${a}-${b}`}
                x1={TREE[a].x}
                y1={TREE[a].y}
                x2={TREE[b].x}
                y2={TREE[b].y}
                className={`tree__edge ${on ? 'is-on' : near ? 'is-near' : ''}`}
              />
            );
          })}
          {TREE_IDS.map((id) => {
            const n: TreeNode = TREE[id];
            const has = owned.has(id);
            const can = canAllocate(data, id);
            const cls = [
              'tree__node',
              `is-${n.size}`,
              has ? 'is-owned' : can ? (credits >= treeCost(data, id) ? 'is-open' : 'is-poor') : '',
              sel === id ? 'is-sel' : '',
            ].join(' ');
            return (
              <g
                key={id}
                className={cls}
                role="button"
                tabIndex={0}
                aria-label={id === TREE_ROOT ? t('tree.root') : effect(n)}
                onClick={() => setSel(id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setSel(id);
                }}
              >
                {n.size === 'big' ? (
                  <rect x={n.x - R.big} y={n.y - R.big} width={R.big * 2} height={R.big * 2} rx={1} />
                ) : n.size === 'unique' ? (
                  <polygon
                    points={`${n.x},${n.y - R.unique} ${n.x + R.unique},${n.y} ${n.x},${n.y + R.unique} ${n.x - R.unique},${n.y}`}
                  />
                ) : (
                  <circle cx={n.x} cy={n.y} r={id === TREE_ROOT ? R.big : R.small} />
                )}
              </g>
            );
          })}
        </svg>
        <aside className="tree__info">
          {node && sel ? (
            <>
              <strong>
                {sel === TREE_ROOT
                  ? t('tree.root')
                  : node.size === 'small'
                    ? t('tree.small')
                    : t(`tree.name.${node.mod ?? ''}`)}
              </strong>
              <small className={`tree__size is-${node.size}`}>{t(`tree.size.${node.size}`)}</small>
              <p>{sel === TREE_ROOT ? t('tree.rootDesc') : effect(node)}</p>
              {owned.has(sel) ? (
                <p className="tree__state">{sel === TREE_ROOT ? '' : t('tree.owned')}</p>
              ) : (
                <button
                  className="btn btn--primary"
                  disabled={!open || credits < cost}
                  onClick={() => act((d) => allocateNode(d, sel))}
                >
                  {open ? t('bunker.price', { n: cost }) : t('tree.locked')}
                </button>
              )}
              {!owned.has(sel) && !open && <small>{t('tree.needs')}</small>}
            </>
          ) : (
            <p>{t('tree.pick')}</p>
          )}
          <hr />
          <p>
            <small>{t('tree.spent', { n: data.tree.spent })}</small>
          </p>
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
            <button className="btn" disabled={data.tree.nodes.length === 0} onClick={() => setConfirm(true)}>
              {t('tree.reset')}
            </button>
          )}
        </aside>
      </div>
    </Screen>
  );
}
