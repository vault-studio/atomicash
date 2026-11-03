// Dossier fase 3: árbol de cada superviviente (pagado con sus chapas) y desterrar, bloquear y cambiar tarjetas.
import { describe, expect, it } from 'vitest';
import { ROSTER } from '../src/config/survivors';
import { TREES, TREE_IDS, TREE_ROOT, nodeCost, treeNeighbors } from '../src/config/tree';
import { allocateNode, canAllocate, resetTree, runOptionsFor } from '../src/meta/actions';
import { defaultSave, normalize } from '../src/meta/save';
import { banishCard, cardKey, lockCard, openLevelChoice, reroll } from '../src/engine/systems/progression';
import { hitEnemy } from '../src/engine/systems/combat';
import { spawnEnemy } from '../src/engine/systems/enemies';
import { createWorld } from '../src/engine/world';

/** Partida con todo el plantel y muchas chapas de cada uno. */
function rich() {
  const s = defaultSave();
  s.profile.starterChosen = 'dot';
  s.profile.active = 'dot';
  const n = normalize(s);
  for (const id of ROSTER) n.survivors[id]!.shards = 1000;
  return n;
}

describe('árbol de cada superviviente', () => {
  it('todos los nodos están unidos al centro y cada personaje tiene el suyo', () => {
    const seen = new Set([TREE_ROOT]);
    const q = [TREE_ROOT];
    while (q.length)
      for (const n of treeNeighbors(q.shift()!))
        if (!seen.has(n)) {
          seen.add(n);
          q.push(n);
        }
    expect(seen.size).toBe(TREE_IDS.length);
    for (const id of ROSTER) {
      expect(Object.keys(TREES[id])).toHaveLength(TREE_IDS.length);
      // Todos los nodos menos el centro dan algo.
      for (const n of TREE_IDS)
        if (n !== TREE_ROOT) expect(TREES[id][n].stat ?? TREES[id][n].mod).toBeDefined();
    }
    // Se especializan: no son el mismo árbol.
    expect(TREES.dot.s1).not.toEqual(TREES.gus.s1);
  });

  it('solo se compra junto a lo que ya tienes, con chapas del propio personaje', () => {
    const s = rich();
    expect(canAllocate(s, 'dot', 'cB')).toBe(false);
    expect(allocateNode(s, 'dot', 'cB')).toBe(false);
    const before = s.survivors.dot!.shards;
    expect(allocateNode(s, 'dot', 'c1')).toBe(true);
    expect(s.survivors.dot!.shards).toBe(before - nodeCost('c1'));
    expect(s.survivors.gus!.shards).toBe(1000);
    expect(canAllocate(s, 'dot', 'c2')).toBe(true);
    // El árbol de Gus no se toca.
    expect(canAllocate(s, 'gus', 'c2')).toBe(false);
    expect(nodeCost('cU')).toBeGreaterThan(nodeCost('cB'));
    expect(nodeCost('cB')).toBeGreaterThan(nodeCost('c1'));
  });

  it('sin chapas suficientes no se compra', () => {
    const s = rich();
    s.survivors.benny!.shards = nodeCost('c1') - 1;
    expect(allocateNode(s, 'benny', 'c1')).toBe(false);
    expect(s.survivors.benny!.tree).toEqual([]);
  });

  it('pasa sus rasgos y modificadores a la run de ese personaje, y desaprender lo devuelve todo', () => {
    const s = rich();
    for (const id of ['c1', 'c2', 'cB', 'k1'] as const) expect(allocateNode(s, 'dot', id)).toBe(true);
    const o = runOptionsFor(s, 'dot');
    expect(o.mods).toMatchObject({
      banish: 1,
      coupons: TREES.dot.k1.v,
      starter: TREES.dot.c1.v + TREES.dot.c2.v,
    });
    expect(runOptionsFor(s, 'gus').mods).toEqual({});
    const w = createWorld('dot', 1, o);
    expect(w.banishes).toBe(1);
    const o2 = s.survivors.dot!;
    const spent = o2.treeSpent;
    const shards = o2.shards;
    expect(resetTree(s, 'dot')).toBe(spent);
    expect(o2.shards).toBe(shards + spent);
    expect(o2.tree).toEqual([]);
  });

  it('el arma inicial hace más daño con los nodos de su rama; las demás no', () => {
    const dmg = (starter: number, src: 'pistola_clavos' | 'llave'): number => {
      const w = createWorld('dot', 1, { hazards: false, mods: starter ? { starter } : {} });
      const e = spawnEnemy(w, 'blindado', w.player.x + 300, w.player.y, false);
      e.hp = e.maxHp = 1e6;
      return hitEnemy(w, e, 100, src, 0);
    };
    expect(dmg(20, 'pistola_clavos') / dmg(0, 'pistola_clavos')).toBeCloseTo(1.2, 1);
    expect(dmg(20, 'llave')).toBe(dmg(0, 'llave'));
  });

  it('cuerpo a cuerpo (Dot) suma a su pasiva', () => {
    const w0 = createWorld('dot', 1, { hazards: false });
    const w1 = createWorld('dot', 1, { hazards: false, mods: { melee: 10 } });
    expect(w1.st.meleeMult - w0.st.meleeMult).toBeCloseTo(0.1, 5);
  });

  it('al cargar se descartan nodos sueltos o desconocidos, y el árbol de cuenta antiguo devuelve sus cupones', () => {
    const s = rich() as unknown as Record<string, unknown> & {
      survivors: Record<string, Record<string, unknown>>;
    };
    s.survivors.dot!.tree = ['c1', 'kU', 'nope'];
    s.tree = { nodes: ['c1'], spent: 50 };
    const credits = (s.profile as { credits: number }).credits;
    const n = normalize(s);
    expect(n.survivors.dot!.tree).toEqual(['c1']);
    expect(n.profile.credits).toBe(credits + 50);
    expect('tree' in n).toBe(false);
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
