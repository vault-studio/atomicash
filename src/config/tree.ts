// Árbol de pasivas del Búnker (dossier §8–9), al estilo de Path of Exile: nodos que se compran con cupones, cada uno
// junto a otro ya comprado. Vale para todos los supervivientes.
// DECISIÓN: árbol de cuenta (no por superviviente) para que el Taller siga siendo lo propio de cada uno.
import type { StatKey } from './traits';

/** Mejoras de run que no son rasgos: cupones extra, desterrar, bloquear, cambios y los únicos. */
export type TreeMod = 'coupons' | 'banish' | 'lock' | 'reroll' | 'hunter' | 'coldBlood' | 'smuggler';

export type NodeSize = 'small' | 'big' | 'unique';

export interface TreeNode {
  readonly size: NodeSize;
  /** Posición en el dibujo, en unidades de 0 a 100 (centro en 50, 50). */
  readonly x: number;
  readonly y: number;
  /** Nodos con los que se une (la unión vale en los dos sentidos). */
  readonly links: readonly string[];
  readonly stat?: StatKey;
  readonly mod?: TreeMod;
  /** Cuánto suma: puntos del rasgo o del modificador. */
  readonly v: number;
}

/** Punto de una rama a `d` (0–1) del centro, en el ángulo `deg` (0 = derecha, sentido horario en pantalla). */
const at = (deg: number, d: number): { x: number; y: number } => {
  const a = (deg * Math.PI) / 180;
  return {
    x: Math.round((50 + Math.cos(a) * d * 46) * 10) / 10,
    y: Math.round((50 + Math.sin(a) * d * 46) * 10) / 10,
  };
};

// Tres ramas: Combate (arriba), Supervivencia (abajo a la izquierda) y Chatarrería (abajo a la derecha). En el
// segundo anillo se unen por nodos puente, así se puede cruzar de una a otra sin volver al centro.
const C = -90;
const S = 150;
const K = 30;

export const TREE = {
  root: { size: 'small', ...at(0, 0), links: ['c1', 's1', 'k1'], v: 0 },

  c1: { size: 'small', ...at(C, 0.18), links: ['c2'], stat: 'dmg', v: 3 },
  c2: { size: 'small', ...at(C, 0.34), links: ['cB', 'bCS', 'bKC'], stat: 'dmg', v: 3 },
  cB: { size: 'big', ...at(C, 0.5), links: ['c3'], mod: 'banish', v: 1 },
  c3: { size: 'small', ...at(C - 12, 0.66), links: ['c4'], stat: 'crit', v: 3 },
  c4: { size: 'small', ...at(C + 12, 0.8), links: ['cU'], stat: 'dmg', v: 5 },
  cU: { size: 'unique', ...at(C, 0.96), links: [], mod: 'hunter', v: 30 },

  s1: { size: 'small', ...at(S, 0.18), links: ['s2'], stat: 'hp', v: 6 },
  s2: { size: 'small', ...at(S, 0.34), links: ['sB', 'bCS', 'bSK'], stat: 'hp', v: 6 },
  sB: { size: 'big', ...at(S, 0.5), links: ['s3'], mod: 'lock', v: 1 },
  s3: { size: 'small', ...at(S - 12, 0.66), links: ['s4'], stat: 'armor', v: 1 },
  s4: { size: 'small', ...at(S + 12, 0.8), links: ['sU'], stat: 'hp', v: 10 },
  sU: { size: 'unique', ...at(S, 0.96), links: [], mod: 'coldBlood', v: 50 },

  k1: { size: 'small', ...at(K, 0.18), links: ['k2'], mod: 'coupons', v: 5 },
  k2: { size: 'small', ...at(K, 0.34), links: ['kB', 'bSK', 'bKC'], mod: 'coupons', v: 5 },
  kB: { size: 'big', ...at(K, 0.5), links: ['k3'], mod: 'reroll', v: 1 },
  k3: { size: 'small', ...at(K - 12, 0.66), links: ['k4'], stat: 'mag', v: 10 },
  k4: { size: 'small', ...at(K + 12, 0.8), links: ['kU'], mod: 'coupons', v: 10 },
  kU: { size: 'unique', ...at(K, 0.96), links: [], mod: 'smuggler', v: 1 },

  // Puentes entre ramas.
  bCS: { size: 'small', ...at((C + S) / 2 - 180, 0.5), links: [], stat: 'regen', v: 0.2 },
  bSK: { size: 'small', ...at((S + K) / 2, 0.5), links: [], stat: 'spd', v: 3 },
  bKC: { size: 'small', ...at((K + C) / 2, 0.5), links: [], stat: 'xp', v: 5 },
} as const satisfies Record<string, TreeNode>;

export type TreeNodeId = keyof typeof TREE;
export const TREE_IDS = Object.keys(TREE) as TreeNodeId[];
export const TREE_ROOT: TreeNodeId = 'root';

/**
 * Coste: cada nodo comprado encarece el siguiente (como los puntos de pasiva) y los grandes y únicos valen más.
 * Desaprender devuelve todo lo gastado.
 */
export const TREE_COST = {
  base: 80,
  growth: 1.14,
  size: { small: 1, big: 2.5, unique: 4 } satisfies Record<NodeSize, number>,
} as const;

export const nodeCost = (id: TreeNodeId, owned: number): number =>
  Math.round(TREE_COST.base * Math.pow(TREE_COST.growth, owned) * TREE_COST.size[TREE[id].size]);

/** Vecinos de un nodo (en los dos sentidos). */
export function treeNeighbors(id: TreeNodeId): TreeNodeId[] {
  const out = new Set<TreeNodeId>(TREE[id].links as readonly TreeNodeId[]);
  for (const k of TREE_IDS) if ((TREE[k].links as readonly string[]).includes(id)) out.add(k);
  return [...out];
}
