// Dossier fase 3: árbol de pasivas y desterrar, bloquear y cambiar tarjetas.
import { describe, expect, it } from 'vitest';
import { TREE, TREE_IDS, TREE_ROOT, nodeCost, treeNeighbors } from '../src/config/tree';
import { allocateNode, canAllocate, resetTree, runOptionsFor } from '../src/meta/actions';
import { defaultSave, normalize } from '../src/meta/save';
import { banishCard, cardKey, lockCard, openLevelChoice, reroll } from '../src/engine/systems/progression';
import { createWorld } from '../src/engine/world';

function rich() {
  const s = defaultSave();
  s.profile.credits = 100000;
  s.profile.starterChosen = 'dot';
  s.profile.active = 'dot';
  return normalize(s);
}

describe('árbol de pasivas', () => {
  it('todos los nodos están unidos al centro', () => {
    const seen = new Set([TREE_ROOT]);
    const q = [TREE_ROOT];
    while (q.length)
      for (const n of treeNeighbors(q.shift()!))
        if (!seen.has(n)) {
          seen.add(n);
          q.push(n);
        }
    expect(seen.size).toBe(TREE_IDS.length);
  });

  it('solo se compra junto a lo que ya tienes, y cada nodo encarece el siguiente', () => {
    const s = rich();
    expect(canAllocate(s, 'cB')).toBe(false);
    expect(allocateNode(s, 'cB')).toBe(false);
    const before = s.profile.credits;
    expect(allocateNode(s, 'c1')).toBe(true);
    expect(s.profile.credits).toBe(before - nodeCost('c1', 0));
    expect(canAllocate(s, 'c2')).toBe(true);
    expect(nodeCost('c2', 1)).toBeGreaterThan(nodeCost('c1', 0));
  });

  it('pasa sus rasgos y modificadores a la run, y desaprender lo devuelve todo', () => {
    const s = rich();
    for (const id of ['c1', 'c2', 'cB', 'k1'] as const) expect(allocateNode(s, id)).toBe(true);
    const o = runOptionsFor(s, 'dot');
    expect(o.mods).toMatchObject({ banish: 1, coupons: TREE.k1.v });
    const w = createWorld('dot', 1, o);
    expect(w.banishes).toBe(1);
    const spent = s.tree.spent;
    const credits = s.profile.credits;
    expect(resetTree(s)).toBe(spent);
    expect(s.profile.credits).toBe(credits + spent);
    expect(s.tree.nodes).toEqual([]);
  });

  it('al cargar se descartan nodos sueltos o desconocidos', () => {
    const s = rich() as unknown as { tree: unknown };
    s.tree = { nodes: ['c1', 'kU', 'nope'], spent: 50 };
    expect(normalize(s).tree.nodes).toEqual(['c1']);
  });
});

describe('desterrar, bloquear y cambiar', () => {
  const world = () => createWorld('dot', 3, { hazards: false, mods: { banish: 1, lock: 1 } });

  it('desterrar cambia la tarjeta y no vuelve a salir', () => {
    const w = world();
    openLevelChoice(w);
    const first = w.choice!.cards.findIndex((c) => c.kind === 'trait' || c.kind === 'up' || c.kind === 'new');
    const key = cardKey(w.choice!.cards[first]!);
    expect(banishCard(w, first)).toBe(true);
    expect(w.banishes).toBe(0);
    expect(w.choice!.cards.map(cardKey)).not.toContain(key);
    for (let i = 0; i < 30; i++) {
      openLevelChoice(w);
      expect(w.choice!.cards.map(cardKey)).not.toContain(key);
    }
    expect(banishCard(w, 0)).toBe(false);
  });

  it('la bloqueada aguanta un cambio y vuelve en la próxima subida', () => {
    const w = world();
    w.rerolls = 1;
    openLevelChoice(w);
    const key = cardKey(w.choice!.cards[1]!);
    expect(lockCard(w, 1)).toBe(true);
    expect(w.locks).toBe(0);
    expect(reroll(w)).toBe(true);
    expect(cardKey(w.choice!.cards[0]!)).toBe(key);
    w.choice = null;
    openLevelChoice(w);
    expect(cardKey(w.choice!.cards[0]!)).toBe(key);
  });
});
