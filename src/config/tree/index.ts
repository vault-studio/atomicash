// Árbol de cada superviviente: nodos unidos al centro que se aprenden con puntos. Los puntos salen del nivel y de las
// estrellas del personaje y se pueden recolocar gratis en cualquier momento.
// DECISIÓN (usuario, 2026-11-04): tres ramas. Radiación, igual para todos, con dos caminos (resistir o aprovechar la
// RAD alta); Pasiva y Oficio, propias de cada personaje; y nodos mixtos que unen las ramas. Sustituye al árbol pagado
// con chapas. Con 15 puntos y 7 nodos por rama caben dos ramas completas y uno más, o cualquier reparto mixto.
export type { TreeMod, NodeSize, NodeGain, TreeBranch, TreeNode } from './types';
export { TREE_IDS, TREE_ROOT } from './shape';
export type { TreeNodeId } from './shape';
export { TREES, TREE_POINTS, treePointsFor, TREE_FX, treeOf, treeNeighbors } from './trees';
