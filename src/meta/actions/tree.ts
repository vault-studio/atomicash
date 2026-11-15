// Árbol de cada superviviente: puntos, aprender, devolver y reiniciar.
import { type StatSurvivorId } from '../../config/survivors';
import { TREE_ROOT, treeNeighbors, treeOf, treePointsFor, type TreeNodeId } from '../../config/tree';
import { type OwnedSurvivor, type SaveData } from '../save';

// ---------- árbol de cada superviviente ----------

/** Puntos del árbol del personaje (nivel y estrellas). */
export const treePoints = (o: OwnedSurvivor): number => treePointsFor(o.level, o.stars);

/** Puntos sin gastar: los totales menos los nodos aprendidos. */
export const treeFree = (o: OwnedSurvivor): number => treePoints(o) - o.tree.length;

/** Se puede aprender si es de su árbol, no lo tiene, toca el centro o un nodo aprendido y queda un punto libre. */
export function canAllocate(s: SaveData, char: StatSurvivorId, id: TreeNodeId): boolean {
  const o = s.survivors[char];
  if (!o || !treeOf(char) || id === TREE_ROOT || o.tree.includes(id) || treeFree(o) < 1) return false;
  return treeNeighbors(id).some((n) => n === TREE_ROOT || o.tree.includes(n));
}

export function allocateNode(s: SaveData, char: StatSurvivorId, id: TreeNodeId): boolean {
  const o = s.survivors[char];
  if (!o || !canAllocate(s, char, id)) return false;
  o.tree.push(id);
  return true;
}

/** Se puede quitar si está aprendido y lo que queda sigue unido al centro. */
export function canRefund(s: SaveData, char: StatSurvivorId, id: TreeNodeId): boolean {
  const o = s.survivors[char];
  if (!o || !o.tree.includes(id)) return false;
  const rest = o.tree.filter((n) => n !== id);
  const seen = new Set<TreeNodeId>([TREE_ROOT]);
  const queue: TreeNodeId[] = [TREE_ROOT];
  while (queue.length)
    for (const n of treeNeighbors(queue.shift()!))
      if (!seen.has(n) && rest.includes(n)) {
        seen.add(n);
        queue.push(n);
      }
  return rest.every((n) => seen.has(n));
}

/** Recoloca gratis: desaprende un nodo y recupera su punto. */
export function refundNode(s: SaveData, char: StatSurvivorId, id: TreeNodeId): boolean {
  const o = s.survivors[char];
  if (!o || !canRefund(s, char, id)) return false;
  o.tree = o.tree.filter((n) => n !== id);
  return true;
}

/** Desaprende todo su árbol. Devuelve los puntos recuperados. */
export function resetTree(s: SaveData, char: StatSurvivorId): number {
  const o = s.survivors[char];
  if (!o) return 0;
  const back = o.tree.length;
  o.tree = [];
  return back;
}
