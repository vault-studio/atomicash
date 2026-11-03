// Árbol de cada superviviente (dossier §8–9), al estilo de Path of Exile: nodos que se compran con chapas del propio
// personaje (las fichas de los duplicados de las cajas), cada uno junto a otro ya comprado.
// DECISIÓN (usuario, 2026-11-03): un árbol por personaje que mejora su especialización, en vez del árbol de cuenta
// pagado con cupones. Todos comparten la forma (posiciones y uniones); cambia lo que da cada nodo.
import type { StatKey } from './traits';
import type { RosterId } from './survivors';

/**
 * Mejoras de run que no son rasgos: cupones extra, desterrar, bloquear, cambios, los únicos y los de especialidad
 * (`melee` % de daño cuerpo a cuerpo, `consDur` % de duración de consumibles, `starter` % de daño del arma inicial y
 * de su fusión).
 */
export type TreeMod =
  | 'coupons'
  | 'banish'
  | 'lock'
  | 'reroll'
  | 'hunter'
  | 'coldBlood'
  | 'smuggler'
  | 'melee'
  | 'consDur'
  | 'starter';

export type NodeSize = 'small' | 'big' | 'unique';

/** Lo que da un nodo: un rasgo o un modificador, y cuánto. */
export interface NodeGain {
  readonly stat?: StatKey;
  readonly mod?: TreeMod;
  /** Cuánto suma: puntos del rasgo o del modificador. */
  readonly v: number;
}

export interface TreeNode extends NodeGain {
  readonly size: NodeSize;
  /** Posición en el dibujo, en unidades de 0 a 100 (centro en 50, 50). */
  readonly x: number;
  readonly y: number;
  /** Nodos con los que se une (la unión vale en los dos sentidos). */
  readonly links: readonly string[];
  /** Rama (para el nombre en pantalla): `c` arriba, `s` abajo a la izquierda, `k` abajo a la derecha, `b` puente. */
  readonly branch: 'root' | 'c' | 's' | 'k' | 'b';
}

/** Punto de una rama a `d` (0–1) del centro, en el ángulo `deg` (0 = derecha, sentido horario en pantalla). */
const at = (deg: number, d: number): { x: number; y: number } => {
  const a = (deg * Math.PI) / 180;
  return {
    x: Math.round((50 + Math.cos(a) * d * 46) * 10) / 10,
    y: Math.round((50 + Math.sin(a) * d * 46) * 10) / 10,
  };
};

// Tres ramas: arriba (`c`, su arma), abajo a la izquierda (`s`) y abajo a la derecha (`k`). En el segundo anillo se
// unen por nodos puente, así se puede cruzar de una a otra sin volver al centro.
const C = -90;
const S = 150;
const K = 30;

const SHAPE = {
  root: { size: 'small', ...at(0, 0), links: ['c1', 's1', 'k1'], branch: 'root' },
  c1: { size: 'small', ...at(C, 0.18), links: ['c2'], branch: 'c' },
  c2: { size: 'small', ...at(C, 0.34), links: ['cB', 'bCS', 'bKC'], branch: 'c' },
  cB: { size: 'big', ...at(C, 0.5), links: ['c3'], branch: 'c' },
  c3: { size: 'small', ...at(C - 12, 0.66), links: ['c4'], branch: 'c' },
  c4: { size: 'small', ...at(C + 12, 0.8), links: ['cU'], branch: 'c' },
  cU: { size: 'unique', ...at(C, 0.96), links: [], branch: 'c' },
  s1: { size: 'small', ...at(S, 0.18), links: ['s2'], branch: 's' },
  s2: { size: 'small', ...at(S, 0.34), links: ['sB', 'bCS', 'bSK'], branch: 's' },
  sB: { size: 'big', ...at(S, 0.5), links: ['s3'], branch: 's' },
  s3: { size: 'small', ...at(S - 12, 0.66), links: ['s4'], branch: 's' },
  s4: { size: 'small', ...at(S + 12, 0.8), links: ['sU'], branch: 's' },
  sU: { size: 'unique', ...at(S, 0.96), links: [], branch: 's' },
  k1: { size: 'small', ...at(K, 0.18), links: ['k2'], branch: 'k' },
  k2: { size: 'small', ...at(K, 0.34), links: ['kB', 'bSK', 'bKC'], branch: 'k' },
  kB: { size: 'big', ...at(K, 0.5), links: ['k3'], branch: 'k' },
  k3: { size: 'small', ...at(K - 12, 0.66), links: ['k4'], branch: 'k' },
  k4: { size: 'small', ...at(K + 12, 0.8), links: ['kU'], branch: 'k' },
  kU: { size: 'unique', ...at(K, 0.96), links: [], branch: 'k' },
  // Puentes entre ramas.
  bCS: { size: 'small', ...at((C + S) / 2 - 180, 0.5), links: [], branch: 'b' },
  bSK: { size: 'small', ...at((S + K) / 2, 0.5), links: [], branch: 'b' },
  bKC: { size: 'small', ...at((K + C) / 2, 0.5), links: [], branch: 'b' },
} as const satisfies Record<string, Omit<TreeNode, keyof NodeGain>>;

export type TreeNodeId = keyof typeof SHAPE;
export const TREE_IDS = Object.keys(SHAPE) as TreeNodeId[];
export const TREE_ROOT: TreeNodeId = 'root';

type Gains = Record<Exclude<TreeNodeId, 'root'>, NodeGain>;

/**
 * Qué da cada nodo, por superviviente. La rama de arriba (`c`) es siempre la de su arma inicial; las otras dos
 * refuerzan su pasiva y su forma de jugar. Los grandes dan desterrar / bloquear / cambiar y los únicos, los efectos
 * especiales del antiguo árbol de cuenta.
 */
const GAINS: Record<RosterId, Gains> = {
  // Dot, la mecánica: pistola de clavos, +15 % cuerpo a cuerpo y el martillo pilón. Taller · Cuerpo a cuerpo · Chatarra.
  dot: {
    c1: { mod: 'starter', v: 5 },
    c2: { mod: 'starter', v: 5 },
    cB: { mod: 'banish', v: 1 },
    c3: { stat: 'crit', v: 3 },
    c4: { mod: 'starter', v: 10 },
    cU: { mod: 'hunter', v: 30 },
    s1: { mod: 'melee', v: 10 },
    s2: { stat: 'hp', v: 8 },
    sB: { mod: 'lock', v: 1 },
    s3: { stat: 'armor', v: 1 },
    s4: { mod: 'melee', v: 15 },
    sU: { mod: 'coldBlood', v: 50 },
    k1: { mod: 'coupons', v: 5 },
    k2: { stat: 'mag', v: 10 },
    kB: { mod: 'reroll', v: 1 },
    k3: { stat: 'kb', v: 15 },
    k4: { mod: 'coupons', v: 10 },
    kU: { mod: 'smuggler', v: 1 },
    bCS: { stat: 'regen', v: 0.2 },
    bSK: { stat: 'spd', v: 3 },
    bKC: { stat: 'xp', v: 5 },
  },
  // Gus, el cocinero: cóctel, consumibles que duran más y mucha vida. Fogones · Despensa · Trapicheo.
  gus: {
    c1: { mod: 'starter', v: 5 },
    c2: { stat: 'area', v: 5 },
    cB: { mod: 'banish', v: 1 },
    c3: { mod: 'starter', v: 5 },
    c4: { stat: 'area', v: 8 },
    cU: { mod: 'hunter', v: 30 },
    s1: { mod: 'consDur', v: 15 },
    s2: { stat: 'hp', v: 10 },
    sB: { mod: 'lock', v: 1 },
    s3: { stat: 'regen', v: 0.3 },
    s4: { mod: 'consDur', v: 25 },
    sU: { mod: 'coldBlood', v: 50 },
    k1: { mod: 'coupons', v: 5 },
    k2: { stat: 'luck', v: 4 },
    kB: { mod: 'reroll', v: 1 },
    k3: { stat: 'mag', v: 10 },
    k4: { mod: 'coupons', v: 10 },
    kU: { mod: 'smuggler', v: 1 },
    bCS: { stat: 'armor', v: 1 },
    bSK: { stat: 'xp', v: 5 },
    bKC: { stat: 'dmg', v: 3 },
  },
  // Benny, el mensajero: pistola de clavos, velocidad, imán y los petardos. Puntería · Carrera · Recados.
  benny: {
    c1: { mod: 'starter', v: 5 },
    c2: { stat: 'cd', v: 3 },
    cB: { mod: 'banish', v: 1 },
    c3: { stat: 'crit', v: 3 },
    c4: { mod: 'starter', v: 10 },
    cU: { mod: 'hunter', v: 30 },
    s1: { stat: 'spd', v: 3 },
    s2: { stat: 'dodge', v: 3 },
    sB: { mod: 'lock', v: 1 },
    s3: { stat: 'spd', v: 4 },
    s4: { stat: 'dodge', v: 5 },
    sU: { mod: 'coldBlood', v: 50 },
    k1: { stat: 'mag', v: 15 },
    k2: { stat: 'xp', v: 5 },
    kB: { mod: 'reroll', v: 1 },
    k3: { mod: 'coupons', v: 5 },
    k4: { stat: 'xp', v: 8 },
    kU: { mod: 'smuggler', v: 1 },
    bCS: { stat: 'hp', v: 6 },
    bSK: { stat: 'regen', v: 0.2 },
    bKC: { stat: 'dmg', v: 3 },
  },
};

const build = (g: Gains): Record<TreeNodeId, TreeNode> =>
  Object.fromEntries(
    TREE_IDS.map((id) => [id, { ...SHAPE[id], ...(id === 'root' ? { v: 0 } : g[id]) }]),
  ) as unknown as Record<TreeNodeId, TreeNode>;

/** Árbol completo (forma + lo que da cada nodo) de cada superviviente del plantel. */
export const TREES: Readonly<Record<RosterId, Readonly<Record<TreeNodeId, TreeNode>>>> = {
  dot: build(GAINS.dot),
  gus: build(GAINS.gus),
  benny: build(GAINS.benny),
};

/**
 * Coste en chapas del personaje según el tamaño del nodo (fijo: no se encarece). Desaprender devuelve todo.
 * Referencia: un duplicado común da 1 chapa, uno raro 2; las estrellas cuestan 5, 10, 20 y 40.
 */
export const TREE_COST = {
  size: { small: 2, big: 5, unique: 10 } satisfies Record<NodeSize, number>,
} as const;

/** Árbol de un superviviente, o null si no es del plantel. */
export const treeOf = (id: string): Readonly<Record<TreeNodeId, TreeNode>> | null =>
  (TREES as Partial<Record<string, Readonly<Record<TreeNodeId, TreeNode>>>>)[id] ?? null;

export const nodeCost = (id: TreeNodeId): number => TREE_COST.size[SHAPE[id].size];

/** Vecinos de un nodo (en los dos sentidos). */
export function treeNeighbors(id: TreeNodeId): TreeNodeId[] {
  const out = new Set<TreeNodeId>(SHAPE[id].links as readonly TreeNodeId[]);
  for (const k of TREE_IDS) if ((SHAPE[k].links as readonly string[]).includes(id)) out.add(k);
  return [...out];
}
