// Dossier fase 3: árbol de cada superviviente (puntos del nivel y las estrellas) y desterrar, bloquear y cambiar tarjetas.
import { describe, expect, it } from 'vitest';
import { ROSTER } from '../src/config/survivors';
import { TREES } from '../src/config/tree';
import { allocateNode, canAllocate, resetTree, runOptionsFor, treeFree } from '../src/meta/actions';
import { defaultSave, normalize } from '../src/meta/save';
import { banishCard, cardKey, lockCard, openLevelChoice, reroll } from '../src/engine/systems/progression';
import { hitEnemy } from '../src/engine/systems/combat';
import { spawnEnemy } from '../src/engine/systems/enemies';
import { createWorld } from '../src/engine/world';

/** Partida con todo el plantel a nivel 30 y 5 estrellas (15 puntos de árbol cada uno). */
function rich() {
  const s = defaultSave();
  s.profile.starterChosen = 'dot';
  s.profile.active = 'dot';
  const n = normalize(s);
  for (const id of ROSTER) {
    n.survivors[id]!.level = 30;
    n.survivors[id]!.stars = 5;
  }
  return n;
}

describe('árbol de cada superviviente', () => {
  it('solo se aprende junto a lo que ya tienes, con puntos del propio personaje', () => {
    const s = rich();
    expect(canAllocate(s, 'dot', 'pB')).toBe(false);
    expect(allocateNode(s, 'dot', 'pB')).toBe(false);
    expect(allocateNode(s, 'dot', 'p1')).toBe(true);
    expect(treeFree(s.survivors.dot!)).toBe(14);
    expect(treeFree(s.survivors.gus!)).toBe(15);
    expect(canAllocate(s, 'dot', 'p2')).toBe(true);
    expect(s.survivors.gus!.tree).toEqual([]);
  });

  it('pasa sus rasgos y modificadores a la run de ese personaje, y recolocar lo devuelve todo', () => {
    const s = rich();
    for (const id of ['l1', 'l2', 'l3', 'lB'] as const) expect(allocateNode(s, 'dot', id)).toBe(true);
    const o = runOptionsFor(s, 'dot');
    expect(o.mods).toMatchObject({
      reroll: 1,
      coupons: TREES.dot.l2.gains[0]!.v,
      starter: TREES.dot.l1.gains[0]!.v,
    });
    expect(runOptionsFor(s, 'gus').mods).toEqual({});
    expect(o.extraRerolls).toBeGreaterThanOrEqual(1);
    const w = createWorld('dot', 1, o);
    expect(w.rerolls).toBeGreaterThanOrEqual(1);
    const o2 = s.survivors.dot!;
    expect(resetTree(s, 'dot')).toBe(4);
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
    s.survivors.dot!.tree = ['p1', 'pU', 'nope'];
    s.tree = { nodes: ['c1'], spent: 50 };
    const credits = (s.profile as { credits: number }).credits;
    const n = normalize(s);
    expect(n.survivors.dot!.tree).toEqual(['p1']);
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
