// Tarjetas: desterrar, bloquear y cambiar.
import { describe, expect, it } from 'vitest';
import { banishCard, cardKey, lockCard, openLevelChoice, reroll } from '../src/engine/systems/progression';
import { createWorld } from '../src/engine/world';

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
