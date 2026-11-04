// Árbol nuevo: puntos, aprender y recolocar, migración del guardado y efecto en el motor de cada modificador.
import { describe, expect, it } from 'vitest';
import { RAD, radTier } from '../src/config/radiation';
import { ROSTER, type StatSurvivorId } from '../src/config/survivors';
import {
  TREES,
  TREE_FX,
  TREE_IDS,
  TREE_ROOT,
  treeNeighbors,
  treePointsFor,
  type TreeMod,
  type TreeNodeId,
} from '../src/config/tree';
import { CONSUMABLE_IDS } from '../src/config/items';
import { RUN } from '../src/config/run';
import {
  allocateNode,
  canAllocate,
  canRefund,
  refundNode,
  resetTree,
  runOptionsFor,
  treeFree,
  treePoints,
} from '../src/meta/actions';
import { defaultSave, normalize, type SaveData } from '../src/meta/save';
import { HIT_MELEE, hitEnemy, hurtPlayer } from '../src/engine/systems/combat';
import { spawnEnemy } from '../src/engine/systems/enemies';
import { addFirePool, updateFirePools } from '../src/engine/systems/weapons';
import { consumeItem, gainXp } from '../src/engine/systems/progression';
import { recalc } from '../src/engine/stats';
import { createWorld, tick } from '../src/engine/world';
import type { World } from '../src/engine/types';

const STEP = 1 / RUN.tickHz;

function save(level: number, stars: number): SaveData {
  const d = defaultSave();
  const s = normalize({ ...d, profile: { ...d.profile, starterChosen: 'dot', active: 'dot' } });
  for (const id of ROSTER) {
    s.survivors[id]!.level = level;
    s.survivors[id]!.stars = stars;
  }
  return s;
}

const learn = (s: SaveData, char: StatSurvivorId, ids: TreeNodeId[]): boolean =>
  ids.every((id) => allocateNode(s, char, id));

const P_BRANCH: TreeNodeId[] = ['p1', 'p2', 'p3', 'pB', 'p4', 'p5', 'pU'];
const L_BRANCH: TreeNodeId[] = ['l1', 'l2', 'l3', 'lB', 'l4', 'l5', 'lU'];

describe('puntos del árbol', () => {
  it('salen del nivel y las estrellas', () => {
    expect(treePointsFor(30, 5)).toBe(15);
    expect(treePointsFor(1, 1)).toBe(1);
    const s = save(30, 5);
    expect(treePoints(s.survivors.dot!)).toBe(15);
    expect(treeFree(s.survivors.dot!)).toBe(15);
  });

  it('caben dos ramas completas y un mixto, y una build 5/5/5', () => {
    const s = save(30, 5);
    expect(learn(s, 'dot', [...P_BRANCH, ...L_BRANCH, 'mPL1'])).toBe(true);
    expect(treeFree(s.survivors.dot!)).toBe(0);
    const t = save(30, 5);
    const build: TreeNodeId[] = ['rT', 'rA1', 'rA2', 'rAU', 'rB1', 'p1', 'p2', 'p3', 'pB', 'p4', 'l1', 'l2'];
    expect(learn(t, 'gus', [...build, 'l3', 'lB', 'l4'])).toBe(true);
  });

  it('no se aprende sin punto libre ni sin unión', () => {
    const s = save(1, 1);
    expect(canAllocate(s, 'dot', 'p2')).toBe(false);
    expect(allocateNode(s, 'dot', 'p1')).toBe(true);
    expect(canAllocate(s, 'dot', 'p2')).toBe(false);
    const t = save(30, 5);
    expect(canAllocate(t, 'dot', 'p2')).toBe(false);
    expect(allocateNode(t, 'dot', 'p2')).toBe(false);
    expect(s.survivors.dot!.tree).toEqual(['p1']);
  });

  it('se recoloca gratis: solo se quita lo que no sostiene a otro', () => {
    const s = save(30, 5);
    learn(s, 'dot', ['p1', 'p2', 'p3']);
    expect(canRefund(s, 'dot', 'p1')).toBe(false);
    expect(canRefund(s, 'dot', 'p3')).toBe(true);
    expect(canRefund(s, 'dot', 'l1')).toBe(false);
    expect(refundNode(s, 'dot', 'p1')).toBe(false);
    expect(refundNode(s, 'dot', 'p3')).toBe(true);
    expect(treeFree(s.survivors.dot!)).toBe(13);
    expect(resetTree(s, 'dot')).toBe(2);
    expect(s.survivors.dot!.tree).toEqual([]);
    expect(treeFree(s.survivors.dot!)).toBe(15);
  });

  it('los nodos pasan sus gains a la run y la mochila suma consExtra', () => {
    const s = save(30, 5);
    s.inventory.consumables.stim = 99;
    const base = runOptionsFor(s, 'gus').consumables!.stim!;
    learn(s, 'gus', ['p1', 'p2', 'p3', 'pB', 'mPL1']);
    const o = runOptionsFor(s, 'gus');
    expect(o.mods).toMatchObject({ consDur: 15, stimHeal: 30, consExtra: 1, coupons: 4 });
    expect(runOptionsFor(s, 'dot').mods).toEqual({});
    expect(o.consumables!.stim).toBe(base + 1);
    const b = save(30, 5);
    learn(b, 'dot', ['l1', 'l2', 'mLR1']);
    expect(runOptionsFor(b, 'dot').bonus!.radDecay).toBeCloseTo(0.2, 5);
  });
});

describe('migración del árbol viejo', () => {
  it('devuelve las chapas una sola vez y vacía el árbol', () => {
    const s = save(30, 5) as unknown as { survivors: Record<string, Record<string, unknown>> };
    s.survivors.dot!.tree = ['c1', 'c2', 's1', 'k1', 'b1'];
    s.survivors.dot!.treeSpent = 12;
    s.survivors.dot!.shards = 5;
    const n = normalize(s);
    expect(n.survivors.dot!.tree).toEqual([]);
    expect(n.survivors.dot!.shards).toBe(17);
    expect('treeSpent' in n.survivors.dot!).toBe(false);
    expect(normalize(n).survivors.dot!.shards).toBe(17);
  });

  it('recorta los nodos que sobran quedándose con los primeros desde el centro', () => {
    const s = save(1, 1) as unknown as { survivors: Record<string, Record<string, unknown>> };
    s.survivors.dot!.tree = ['p1', 'p2', 'p3'];
    expect(normalize(s).survivors.dot!.tree).toEqual(['p1']);
  });
});

describe('forma del árbol', () => {
  it('todo nodo se alcanza desde el centro', () => {
    const seen = new Set<TreeNodeId>([TREE_ROOT]);
    const q: TreeNodeId[] = [TREE_ROOT];
    while (q.length)
      for (const n of treeNeighbors(q.shift()!))
        if (!seen.has(n)) {
          seen.add(n);
          q.push(n);
        }
    expect(seen.size).toBe(TREE_IDS.length);
  });

  it('todos dan algo menos el centro; los mixtos dan dos cosas', () => {
    for (const id of ROSTER)
      for (const n of TREE_IDS) {
        const g = TREES[id][n].gains;
        if (n === TREE_ROOT) expect(g).toHaveLength(0);
        else if (TREES[id][n].branch === 'm') expect(g).toHaveLength(2);
        else expect(g).toHaveLength(1);
      }
  });
});

// ---------- efectos en el motor ----------

const mk = (mods: Partial<Record<TreeMod, number>>, extra: Record<string, unknown> = {}): World =>
  createWorld('dot', 7, { startWeapon: null, hazards: false, mods, ...extra });

const setRad = (w: World, rad: number): void => {
  w.player.rad = rad;
  recalc(w);
};

const target = (w: World, hp = 1e6) => {
  const e = spawnEnemy(w, 'blindado', w.player.x + 300, w.player.y, false);
  e.hp = e.maxHp = hp;
  return e;
};

const IDLE = { moveX: 0, moveY: 0 };

describe('efectos del árbol en el motor', () => {
  it('radRes reduce la RAD recibida', () => {
    expect(mk({ radRes: 20 }).st.radGain / mk({}).st.radGain).toBeCloseTo(0.8, 5);
  });

  it('radPen reduce la pérdida de PV máximos por RAD', () => {
    const a = mk({});
    const b = mk({ radPen: 50 });
    setRad(a, 70);
    setRad(b, 70);
    expect(radTier(70).hpPen).toBeGreaterThan(0);
    expect(b.st.maxHp).toBeGreaterThan(a.st.maxHp);
  });

  it('radBoost amplía el bonus de daño de los tramos', () => {
    const a = mk({});
    const b = mk({ radBoost: 100 });
    setRad(a, 40);
    setRad(b, 40);
    expect(b.st.dmgMult).toBeGreaterThan(a.st.dmgMult);
  });

  it('radSave salva una vez de la RAD máxima', () => {
    const w = mk({ radSave: 1 });
    w.player.rad = RAD.max;
    tick(w, IDLE, STEP);
    expect(w.player.deadAt).toBeNull();
    expect(w.player.rad).toBeCloseTo(TREE_FX.saveTo, 0);
    w.player.rad = RAD.max;
    tick(w, IDLE, STEP);
    expect(w.player.deadAt).not.toBeNull();
  });

  it('sin radSave la RAD máxima mata', () => {
    const w = mk({});
    w.player.rad = RAD.max;
    tick(w, IDLE, STEP);
    expect(w.player.deadAt).not.toBeNull();
  });

  it('con RAD alta suben daño, enfriamiento y regeneración; con RAD baja no', () => {
    const mods = { radHighDmg: 20, radHighCd: 10, radHighRegen: 0.5 };
    const lo = mk(mods);
    const hi = mk(mods);
    const ref = mk({});
    setRad(lo, TREE_FX.highRad - 1);
    setRad(hi, TREE_FX.highRad);
    setRad(ref, TREE_FX.highRad);
    expect(hi.st.dmgMult / ref.st.dmgMult).toBeCloseTo(1.2, 5);
    expect(hi.st.cdMult).toBeLessThan(ref.st.cdMult);
    expect(hi.st.regen - ref.st.regen).toBeCloseTo(0.5, 5);
    setRad(ref, TREE_FX.highRad - 1);
    expect(lo.st.dmgMult).toBeCloseTo(ref.st.dmgMult, 5);
    expect(lo.st.cdMult).toBeCloseTo(ref.st.cdMult, 5);
    expect(lo.st.regen).toBeCloseTo(ref.st.regen, 5);
  });

  it('moveDmg solo cuenta mientras se mueve', () => {
    const w = mk({ moveDmg: 10 });
    const ref = mk({});
    w.player.moving = true;
    recalc(w);
    expect(w.st.dmgMult / ref.st.dmgMult).toBeCloseTo(1.1, 5);
    w.player.moving = false;
    recalc(w);
    expect(w.st.dmgMult).toBeCloseTo(ref.st.dmgMult, 5);
  });

  it('meleeStun aturde a quien no es jefe con un golpe cuerpo a cuerpo', () => {
    const w = mk({ meleeStun: 100 });
    const e = target(w);
    hitEnemy(w, e, 1, 'llave', HIT_MELEE);
    expect(e.stun).toBeGreaterThanOrEqual(TREE_FX.stunDur);
    const boss = target(w);
    boss.boss = true;
    hitEnemy(w, boss, 1, 'llave', HIT_MELEE);
    expect(boss.stun).toBe(0);
    const f = target(w);
    hitEnemy(w, f, 1, 'llave', 0);
    expect(f.stun).toBe(0);
    const w0 = mk({});
    const e0 = target(w0);
    hitEnemy(w0, e0, 1, 'llave', HIT_MELEE);
    expect(e0.stun).toBe(0);
  });

  it('meleeHeal cura al matar cuerpo a cuerpo', () => {
    const w = mk({ meleeHeal: 3 });
    w.player.hp = 10;
    hitEnemy(w, target(w, 1), 1e5, 'llave', 0);
    expect(w.player.hp).toBe(10);
    hitEnemy(w, target(w, 1), 1e5, 'llave', HIT_MELEE);
    expect(w.player.hp).toBeCloseTo(13, 5);
  });

  it('fusionDmg mejora las armas fusionadas y no las demás', () => {
    const dmg = (v: number, src: 'dinamo' | 'llave'): number => {
      const w = mk(v ? { fusionDmg: v } : {});
      return hitEnemy(w, target(w), 100, src, 0);
    };
    expect(dmg(20, 'dinamo') / dmg(0, 'dinamo')).toBeCloseTo(1.2, 1);
    expect(dmg(20, 'llave')).toBe(dmg(0, 'llave'));
  });

  it('burnDmg multiplica el daño por segundo de las quemaduras', () => {
    const burnOf = (v: number): number => {
      const w = mk(v ? { burnDmg: v } : {});
      const e = target(w);
      addFirePool(w, e.x, e.y, 80, 5, 1, 0.5, 'coctel', 10);
      w.enemyGrid.build(w.enemies.items, w.enemies.count);
      updateFirePools(w, STEP);
      return Math.max(...e.burnD);
    };
    expect(burnOf(50)).toBeCloseTo(15, 5);
    expect(burnOf(0)).toBeCloseTo(10, 5);
  });

  const stimSlot = CONSUMABLE_IDS.indexOf('stim');

  it('stimHeal aumenta la curación del estimulante', () => {
    const healed = (v: number): number => {
      const w = mk(v ? { stimHeal: v } : {}, { consumables: { stim: 3 } });
      w.player.hp = 1;
      consumeItem(w, stimSlot);
      return w.player.hp - 1;
    };
    expect(healed(0)).toBeGreaterThan(0);
    expect(healed(50) / healed(0)).toBeCloseTo(1.5, 1);
  });

  it('consSave a veces no gasta el consumible', () => {
    const a = mk({ consSave: 100 }, { consumables: { stim: 3 } });
    a.player.hp = 1;
    expect(consumeItem(a, stimSlot)).toBe(true);
    expect(a.cons.stim).toBe(3);
    expect(a.consUsed).toBe(1);
    const b = mk({}, { consumables: { stim: 3 } });
    b.player.hp = 1;
    consumeItem(b, stimSlot);
    expect(b.cons.stim).toBe(2);
  });

  it('dodgeRush da velocidad un rato tras esquivar', () => {
    const w = mk({ dodgeRush: 30 }, { bonus: { dodge: 1000 } });
    const base = w.st.speed;
    let dodged = false;
    for (let i = 0; i < 400 && !dodged; i++) {
      w.player.inv = 0;
      dodged = hurtPlayer(w, 1, 0, true) === -1;
    }
    expect(dodged).toBe(true);
    expect(w.player.rush).toBeCloseTo(TREE_FX.rushDur, 5);
    recalc(w);
    expect(w.st.speed / base).toBeCloseTo(1.3, 5);
    w.player.rush = 0;
    recalc(w);
    expect(w.st.speed).toBeCloseTo(base, 5);
  });

  it('levelHeal cura un % de los PV máximos al subir de nivel', () => {
    const w = mk({ levelHeal: 10 });
    w.player.hp = 1;
    gainXp(w, w.xpNext, true);
    expect(w.player.hp).toBeCloseTo(1 + w.player.maxHp * 0.1, 5);
  });
});
