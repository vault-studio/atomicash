// Geometría y colores del radar del árbol: radios de nodo, cuñas de rama, anillos.
import { type CSSProperties } from 'react';
import { type TreeNode } from '../../../../config/tree';

/** Radio de cada tamaño de nodo, en unidades del dibujo (0–100). */
export const R = { small: 3, big: 4, unique: 5, root: 4.2 } as const;

export type Branch = TreeNode['branch'];
/** Cuñas del fondo: Radiación arriba, Pasiva abajo a la izquierda y Oficio abajo a la derecha. */
export const WEDGES = [
  { b: 'r', angle: -90 },
  { b: 'p', angle: 150 },
  { b: 'l', angle: 30 },
] as const;
export const BRANCH_COLOR: Readonly<Record<Branch, string>> = {
  r: '#3cff6b',
  ra: '#9fb3c0',
  rb: '#c8ff00',
  p: '#ff6a3a',
  l: '#ffc83a',
  m: '#f3e9d2',
  root: '#3cff6b',
};
/** Filas de progreso por rama: qué ramas del árbol cuentan en cada una. */
export const PROGRESS: readonly {
  key: 'rad' | 'p' | 'l' | 'mixed';
  branches: readonly Branch[];
  color: Branch;
}[] = [
  { key: 'rad', branches: ['r', 'ra', 'rb'], color: 'r' },
  { key: 'p', branches: ['p'], color: 'p' },
  { key: 'l', branches: ['l'], color: 'l' },
  { key: 'mixed', branches: ['m'], color: 'm' },
];

/** Punto a `d` (0–1) del centro en el ángulo `deg`, como `at` de config/tree.ts. */
export function polar(deg: number, d: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [50 + Math.cos(a) * d * 46, 50 + Math.sin(a) * d * 46];
}

/** Cuña de una rama (±60° alrededor de su ángulo) para teñir el fondo. */
export function wedge(deg: number): string {
  const [x1, y1] = polar(deg - 60, 1.08);
  const [x2, y2] = polar(deg + 60, 1.08);
  const r = 46 * 1.08;
  return `M50 50 L${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2} Z`;
}

export const RINGS = [0.17, 0.3, 0.43, 0.56, 0.69, 0.81, 0.95];
export const colorVar = (c: string): CSSProperties => ({ '--c': c }) as CSSProperties;
