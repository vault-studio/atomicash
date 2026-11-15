// Árboles construidos por personaje, puntos disponibles y vecinos de cada nodo.
import { TUNING } from '../tuning';
import type { RosterId } from '../survivors';
import { gainsOf } from './gains';
import { SHAPE, TREE_IDS, type TreeNodeId } from './shape';
import type { TreeNode } from './types';

const build = (char: RosterId): Record<TreeNodeId, TreeNode> =>
  Object.fromEntries(
    TREE_IDS.map((id) => [id, { ...SHAPE[id], gains: gainsOf(char, id) }]),
  ) as unknown as Record<TreeNodeId, TreeNode>;

/** Árbol completo (forma + lo que da cada nodo) de cada superviviente del plantel. */
export const TREES: Readonly<Record<RosterId, Readonly<Record<TreeNodeId, TreeNode>>>> = {
  dot: build('dot'),
  gus: build('gus'),
  benny: build('benny'),
};

/**
 * Puntos del árbol: uno cada `levelEvery` niveles y `perStar` por estrella. Con nivel 30 y 5 estrellas, 15. Cada nodo
 * cuesta un punto.
 */
export const TREE_POINTS = {
  levelEvery: 3,
  perStar: 1,
} as const;

export const treePointsFor = (level: number, stars: number): number =>
  Math.floor(level / TREE_POINTS.levelEvery) + stars * TREE_POINTS.perStar;

/** Valores de los efectos del árbol (`src/data/tuning.json` → `treeFx`). */
export const TREE_FX = TUNING.treeFx;

/** Árbol de un superviviente, o null si no es del plantel. */
export const treeOf = (id: string): Readonly<Record<TreeNodeId, TreeNode>> | null =>
  (TREES as Partial<Record<string, Readonly<Record<TreeNodeId, TreeNode>>>>)[id] ?? null;

/** Vecinos de un nodo (en los dos sentidos). */
export function treeNeighbors(id: TreeNodeId): TreeNodeId[] {
  const out = new Set<TreeNodeId>(SHAPE[id].links as readonly TreeNodeId[]);
  for (const k of TREE_IDS) if ((SHAPE[k].links as readonly string[]).includes(id)) out.add(k);
  return [...out];
}
