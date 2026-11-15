// Forma del árbol: posición de cada nodo en el radar (igual para todos los personajes).
import type { TreeNode } from './types';

/** Punto de una rama a `d` (0–1) del centro, en el ángulo `deg` (0 = derecha, sentido horario en pantalla). */
const at = (deg: number, d: number): { x: number; y: number } => {
  const a = (deg * Math.PI) / 180;
  return {
    x: Math.round((50 + Math.cos(a) * d * 46) * 10) / 10,
    y: Math.round((50 + Math.sin(a) * d * 46) * 10) / 10,
  };
};

// Ángulos de las ramas: Radiación arriba (con un camino a cada lado), Pasiva abajo a la izquierda y Oficio abajo a la
// derecha. Los mixtos quedan entre dos ramas, en dos alturas, y permiten cruzar de una a otra sin volver al centro.
// Pasiva y Oficio van en zigzag (`ZIG` grados a cada lado): siete nodos en línea recta no caben en el radio.
const ZIG = 12;
const P = 150;
const L = 30;
const RA = -112;
const RB = -68;
const MRP = 199;
const MPL = 90;
const MLR = -19;

export const SHAPE = {
  root: { size: 'small', ...at(0, 0), links: ['rT', 'p1', 'l1'], branch: 'root' },
  rT: { size: 'small', ...at(-90, 0.2), links: ['rA1', 'rB1'], branch: 'r' },
  rA1: { size: 'small', ...at(RA, 0.42), links: ['rA2', 'mRP1'], branch: 'ra' },
  rA2: { size: 'big', ...at(RA, 0.66), links: ['rAU', 'mRP2'], branch: 'ra' },
  rAU: { size: 'unique', ...at(RA, 0.94), links: [], branch: 'ra' },
  rB1: { size: 'small', ...at(RB, 0.42), links: ['rB2', 'mLR1'], branch: 'rb' },
  rB2: { size: 'big', ...at(RB, 0.66), links: ['rBU', 'mLR2'], branch: 'rb' },
  rBU: { size: 'unique', ...at(RB, 0.94), links: [], branch: 'rb' },
  p1: { size: 'small', ...at(P, 0.19), links: ['p2'], branch: 'p' },
  p2: { size: 'small', ...at(P - ZIG, 0.32), links: ['p3', 'mRP1', 'mPL1'], branch: 'p' },
  p3: { size: 'small', ...at(P + ZIG, 0.45), links: ['pB'], branch: 'p' },
  pB: { size: 'big', ...at(P, 0.57), links: ['p4'], branch: 'p' },
  p4: { size: 'small', ...at(P - ZIG, 0.7), links: ['p5', 'mRP2', 'mPL2'], branch: 'p' },
  p5: { size: 'small', ...at(P + ZIG, 0.82), links: ['pU'], branch: 'p' },
  pU: { size: 'unique', ...at(P, 0.95), links: [], branch: 'p' },
  l1: { size: 'small', ...at(L, 0.19), links: ['l2'], branch: 'l' },
  l2: { size: 'small', ...at(L - ZIG, 0.32), links: ['l3', 'mPL1', 'mLR1'], branch: 'l' },
  l3: { size: 'small', ...at(L + ZIG, 0.45), links: ['lB'], branch: 'l' },
  lB: { size: 'big', ...at(L, 0.57), links: ['l4'], branch: 'l' },
  l4: { size: 'small', ...at(L - ZIG, 0.7), links: ['l5', 'mPL2', 'mLR2'], branch: 'l' },
  l5: { size: 'small', ...at(L + ZIG, 0.82), links: ['lU'], branch: 'l' },
  lU: { size: 'unique', ...at(L, 0.95), links: [], branch: 'l' },
  mRP1: { size: 'small', ...at(MRP, 0.42), links: [], branch: 'm' },
  mRP2: { size: 'small', ...at(MRP, 0.74), links: [], branch: 'm' },
  mPL1: { size: 'small', ...at(MPL, 0.38), links: [], branch: 'm' },
  mPL2: { size: 'small', ...at(MPL, 0.72), links: [], branch: 'm' },
  mLR1: { size: 'small', ...at(MLR, 0.42), links: [], branch: 'm' },
  mLR2: { size: 'small', ...at(MLR, 0.74), links: [], branch: 'm' },
} as const satisfies Record<string, Omit<TreeNode, 'gains'>>;

export type TreeNodeId = keyof typeof SHAPE;
export const TREE_IDS = Object.keys(SHAPE) as TreeNodeId[];
export const TREE_ROOT: TreeNodeId = 'root';
