import { describe, expect, it } from 'vitest';
import { ENEMY_STATS, MOB_IDS, type EnemyStats } from '../src/config/enemies';
import { BUILDINGS, PROP_LIST, PROP_SHAPES, PROPS } from '../src/config/props';
import { RUN } from '../src/config/run';
import { buildingBlock, hazardAt, nearBuilding } from '../src/engine/hazards';
import {
  areaClutter,
  BUILDING_WEIGHT,
  chestSpot,
  createCellObject,
  objectAt,
  buildingState,
  scanArea,
} from '../src/engine/obstacles';
import { CACHE_ROLL, COUPONS } from '../src/config/run';
import { killEnemy } from '../src/engine/systems/combat';
import { applyChoice, openCacheChoice } from '../src/engine/systems/progression';
import { compactEnemies, spawnEnemy } from '../src/engine/systems/enemies';
import type { World } from '../src/engine/types';
import { createWorld, results, tick } from '../src/engine/world';

const T = RUN.groundCell;
const STEP = 1 / RUN.tickHz;
const cell = createCellObject();

/** El objeto de una casilla más cercano a la salida, con su centro y radio. */
function nearestSingle(w: World): { x: number; y: number; r: number } {
  const ci = Math.floor(w.start.x / T);
  const cj = Math.floor(w.start.y / T);
  for (let d = 1; d < 12; d++)
    for (let j = cj - d; j <= cj + d; j++)
      for (let i = ci - d; i <= ci + d; i++)
        if (objectAt(w.seed, i, j, w.start.x, w.start.y, cell) && PROP_LIST[cell.prop]!.cells === 1)
          return { x: cell.x, y: cell.y, r: PROP_SHAPES[cell.prop]!.r };
  throw new Error('sin obstáculos cerca de la salida');
}

/** Primera semilla con un edificio del tipo pedido a menos de 12 casillas de la salida. */
function worldWithBuilding(kind: string): { w: World; x: number; y: number } {
  for (let seed = 1; seed < 400; seed++) {
    const w = createWorld('dot', seed, { startWeapon: null });
    const b = w.buildings.find((x) => x.kind === kind);
    if (b) return { w, x: b.x, y: b.y };
  }
  throw new Error(`sin edificio ${kind}`);
}

describe('mapa de la pausa', () => {
  it('encuentra lo mismo que la ventana de la partida y dice cómo va cada edificio', () => {
    const w = createWorld('dot', 3);
    let found = null;
    for (let k = 1; k < 12 && !found; k++) {
      w.player.x = w.start.x + k * 900;
      w.player.y = w.start.y;
      found = scanArea(w, 34).buildings.find((b) => b.kind !== 'supply') ?? null;
    }
    expect(found).not.toBeNull();
    const b = found!;
    expect(buildingState(w, b)).toBe('new');
    w.garrisoned.add(b.key);
    const O = BUILDINGS.cache.offset;
    const g = { x: b.x + O, y: b.y + O, left: 2 };
    w.garrisons.push(g);
    expect(buildingState(w, b)).toBe('active');
    g.left = 0;
    expect(buildingState(w, b)).toBe('done');
  });

  it('marca los suministros como hechos en cuanto salen sus cajas', () => {
    const w = createWorld('dot', 3);
    const b = { x: 0, y: 0, kind: 'supply' as const, key: 'x' };
    expect(buildingState(w, b)).toBe('new');
    w.garrisoned.add('x');
    expect(buildingState(w, b)).toBe('done');
  });
});

describe('obstáculos', () => {
  it('nunca pisan ácido, y los de varias casillas ocupan todas las suyas sin pisarse', () => {
    for (let seed = 1; seed < 6; seed++) {
      const owner = new Map<string, string>();
      for (let j = 0; j < 81; j++)
        for (let i = 0; i < 81; i++) {
          if (!objectAt(seed, i, j, 0, 0, cell)) continue;
          expect(hazardAt(seed, i, j, 0, 0)).toBe(-1);
          owner.set(`${i},${j}`, `${cell.i},${cell.j},${cell.prop}`);
        }
      for (const [, v] of owner) {
        const [ai, aj, prop] = v.split(',').map(Number) as [number, number, number];
        const cells = PROP_LIST[prop]!.cells;
        const [n, m] = cells === 1 ? [1, 1] : cells === 2 ? [2, 1] : [3, 3];
        for (let dj = 0; dj < m; dj++)
          for (let di = 0; di < n; di++) expect(owner.get(`${ai + di},${aj + dj}`)).toBe(v);
      }
    }
  });

  it('el jugador no los atraviesa y los rodea', () => {
    const w = createWorld('dot', 3, { startWeapon: null });
    const o = nearestSingle(w);
    const p = w.player;
    p.x = o.x - o.r - p.r - 30;
    p.y = o.y;
    for (let t = 0; t < 4 / STEP; t++) {
      tick(w, { moveX: 1, moveY: 0 }, STEP);
      expect(Math.hypot(p.x - o.x, p.y - o.y)).toBeGreaterThanOrEqual(o.r + p.r - 0.5);
    }
    expect(p.x).toBeGreaterThan(o.x + o.r);
  });

  it('el jugador no entra en un edificio', () => {
    const { w, x, y } = worldWithBuilding('necro');
    const p = w.player;
    p.x = x - 2.5 * T;
    p.y = y;
    for (let t = 0; t < 3 / STEP; t++) {
      tick(w, { moveX: 1, moveY: 0 }, STEP);
      const inside = Math.abs(p.x - x) < 1.2 * T && Math.abs(p.y - y) < 1.2 * T;
      expect(inside).toBe(false);
    }
  });

  it('las balas desaparecen al darles', () => {
    const w = createWorld('dot', 3, { startWeapon: null });
    const o = nearestSingle(w);
    w.player.x = o.x - o.r - 60;
    w.player.y = o.y;
    tick(w, { moveX: 0, moveY: 0 }, STEP);
    const s = w.shots.acquire();
    Object.assign(s, {
      x: o.x - o.r - 20,
      y: o.y,
      vx: 600,
      vy: 0,
      r: 4,
      life: 2,
      dmg: 1,
      pierce: 0,
      nHit: 0,
    });
    for (let t = 0; t < 0.2 / STEP; t++) tick(w, { moveX: 0, moveY: 0 }, STEP);
    expect(w.shots.count).toBe(0);
  });

  it('los enemigos de tierra no los atraviesan', () => {
    const w = createWorld('dot', 3, { startWeapon: null });
    const o = nearestSingle(w);
    const p = w.player;
    p.x = o.x + o.r + 80;
    p.y = o.y;
    const type = MOB_IDS.find((id) => !(ENEMY_STATS[id] as EnemyStats).flying && id !== 'torreta')!;
    const id = spawnEnemy(w, type, o.x - o.r - 40, o.y, false).id;
    for (let t = 0; t < 2 / STEP; t++) {
      tick(w, { moveX: 0, moveY: 0 }, STEP);
      const e = w.enemies.items.slice(0, w.enemies.count).find((x) => x.id === id);
      if (!e || e.dead) break;
      expect(Math.hypot(e.x - o.x, e.y - o.y)).toBeGreaterThanOrEqual(o.r + e.r - 0.5);
    }
  });
});

describe('edificios', () => {
  it.each(['raiders', 'robots', 'necro'] as const)(
    '%s: aparece su guarnición una sola vez al acercarse',
    (kind) => {
      const { w, x, y } = worldWithBuilding(kind);
      const p = w.player;
      p.x = x - BUILDINGS.trigger + 50;
      p.y = y;
      const types = (): string[] =>
        w.enemies.items
          .slice(0, w.enemies.count)
          .filter((e) => Math.hypot(e.x - x, e.y - y) < BUILDINGS.ring + BUILDINGS.jitter + T)
          .map((e) => e.type);
      tick(w, { moveX: 0, moveY: 0 }, STEP);
      const near = types();
      for (const [type, count] of BUILDINGS.enemies[kind])
        expect(near.filter((t) => t === type).length).toBeGreaterThanOrEqual(count);
      const before = w.enemies.count;
      tick(w, { moveX: 0, moveY: 0 }, STEP);
      expect(w.enemies.count).toBeLessThanOrEqual(before + 1);
    },
  );

  it.each(['raiders', 'robots', 'necro'] as const)(
    '%s: al acabar con toda la guarnición sale un cofre especial delante que da cupones y un nivel',
    (kind) => {
      const { w, x, y } = worldWithBuilding(kind);
      const p = w.player;
      p.x = x - BUILDINGS.trigger + 50;
      p.y = y;
      tick(w, { moveX: 0, moveY: 0 }, STEP);
      const guards = w.enemies.items
        .slice(0, w.enemies.count)
        .filter(
          (e) => e.gar >= 0 && Math.hypot(w.garrisons[e.gar]!.x - x, w.garrisons[e.gar]!.y - y) < 3 * T,
        );
      // Puede haber otro edificio cerca con su propia guarnición: solo cuenta el cofre de este.
      const caches = () =>
        w.pickups.items
          .slice(0, w.pickups.count)
          .filter((k) => k.kind === 'cache' && Math.hypot(k.x - x, k.y - y) < 3 * T);
      for (const e of guards.slice(1)) killEnemy(w, e, 'llave');
      expect(caches()).toHaveLength(0);
      killEnemy(w, guards[0]!, 'llave');
      const [c] = caches();
      expect(c).toBeDefined();
      // Delante del edificio = hacia la cámara (+x, +y), fuera de su huella.
      expect(c!.x).toBeGreaterThan(x + 1.2 * T);
      expect(c!.y).toBeGreaterThan(y + 1.2 * T);
      w.nextEvent = Infinity;
      const level = w.level;
      const coupons = w.coupons;
      p.x = c!.x;
      p.y = c!.y;
      tick(w, { moveX: 0, moveY: 0 }, STEP);
      // Abre la tragaperras de cupones; al cobrar suma los cupones y un nivel.
      expect(w.choice?.type).toBe('cache');
      const card = w.choice!.cards[0]!;
      expect(card.kind).toBe('coupons');
      const n = card.kind === 'coupons' ? card.n : 0;
      expect(n).toBeGreaterThanOrEqual(CACHE_ROLL.tiers[CACHE_ROLL.tiers.length - 1]![1]);
      expect(n).toBeLessThanOrEqual(CACHE_ROLL.jackpot);
      applyChoice(w, 0);
      expect(w.coupons - coupons).toBe(n);
      expect(w.level).toBe(level + 1);
      expect(caches()).toHaveLength(0);
    },
  );

  it('el supermercado sale rodeado de 3 o 4 cajas de suministros', () => {
    const { w, x, y } = worldWithBuilding('supply');
    w.player.x = x - BUILDINGS.trigger + 50;
    w.player.y = y;
    tick(w, { moveX: 0, moveY: 0 }, STEP);
    const crates = w.pickups.items
      .slice(0, w.pickups.count)
      .filter(
        (k) => k.kind === 'crate' && Math.hypot(k.x - x, k.y - y) < BUILDINGS.ring + BUILDINGS.jitter + 1,
      );
    expect(crates.length).toBeGreaterThanOrEqual(BUILDINGS.crates.min);
    expect(crates.length).toBeLessThanOrEqual(BUILDINGS.crates.max);
  });
});

describe('cupones', () => {
  it('los enemigos normales los sueltan rara vez y suman al final de la partida', () => {
    const w = createWorld('dot', 5, { startWeapon: null, hazards: false });
    let drops = 0;
    for (let n = 0; n < 2000; n++) {
      const before = w.pickups.items.slice(0, w.pickups.count).filter((k) => k.kind === 'coupon').length;
      killEnemy(w, spawnEnemy(w, 'necrofago', w.player.x + 3000, w.player.y, false), 'llave');
      const after = w.pickups.items.slice(0, w.pickups.count).filter((k) => k.kind === 'coupon').length;
      drops += after - before;
      compactEnemies(w);
    }
    expect(drops).toBeGreaterThan(2000 * COUPONS.dropChance * 0.4);
    expect(drops).toBeLessThan(2000 * COUPONS.dropChance * 2);
    const base = results(w).credits;
    w.coupons += 37;
    expect(results(w).credits).toBe(base + 37);
  });
});

describe('tragaperras del cofre especial', () => {
  it('reparte los cupones según los tramos de CACHE_ROLL', () => {
    const w = createWorld('dot', 7, { hazards: false });
    const N = 100_000;
    const hits = CACHE_ROLL.tiers.map(() => 0);
    let sum = 0;
    for (let i = 0; i < N; i++) {
      openCacheChoice(w);
      const c = w.choice!.cards[0]!;
      const n = c.kind === 'coupons' ? c.n : -1;
      const k = CACHE_ROLL.tiers.findIndex(([, lo, hi]) => n >= lo && n <= hi);
      expect(k).toBeGreaterThanOrEqual(0);
      hits[k]!++;
      sum += n;
    }
    w.choice = null;
    CACHE_ROLL.tiers.forEach(([p], k) => expect(Math.abs(hits[k]! / N - p)).toBeLessThan(0.006));
    expect(sum / N).toBeGreaterThan(230);
    expect(sum / N).toBeLessThan(265);
    expect(CACHE_ROLL.tiers.reduce((a, [p]) => a + p, 0)).toBeCloseTo(1);
  });

  it('con `capAfter` cupones ya recogidos solo da entre `capped[0]` y `capped[1]`', () => {
    const [lo, hi] = CACHE_ROLL.capped;
    for (const smuggler of [false, true]) {
      // «Contrabandista» tira dos veces: tampoco pasa del tope.
      const w = createWorld('dot', 7, { hazards: false, mods: smuggler ? { smuggler: 1 } : {} });
      w.coupons = CACHE_ROLL.capAfter - 1;
      let max = 0;
      for (let i = 0; i < 2000; i++) {
        openCacheChoice(w);
        const c = w.choice!.cards[0]!;
        max = Math.max(max, c.kind === 'coupons' ? c.n : 0);
      }
      // Justo por debajo del tope, todavía puede salir más de `hi`.
      expect(max).toBeGreaterThan(hi);
      w.coupons = CACHE_ROLL.capAfter;
      let seenLo = Infinity;
      let seenHi = 0;
      for (let i = 0; i < 2000; i++) {
        openCacheChoice(w);
        const c = w.choice!.cards[0]!;
        const n = c.kind === 'coupons' ? c.n : -1;
        expect(n).toBeGreaterThanOrEqual(lo);
        expect(n).toBeLessThanOrEqual(hi);
        seenLo = Math.min(seenLo, n);
        seenHi = Math.max(seenHi, n);
      }
      expect(seenLo).toBeLessThan(lo + 10);
      expect(seenHi).toBeGreaterThan(hi - 10);
    }
  });
});

describe('separación de las zonas especiales', () => {
  const B = PROPS.block;
  const SPAN = 60;

  it('dos edificios nunca salen juntos', () => {
    let found = 0;
    for (let seed = 1; seed < 8; seed++) {
      const blocks: [number, number][] = [];
      for (let bj = -SPAN; bj < SPAN; bj++)
        for (let bi = -SPAN; bi < SPAN; bi++) if (buildingBlock(seed, bi, bj, 0, 0)) blocks.push([bi, bj]);
      found += blocks.length;
      for (const [ai, aj] of blocks)
        for (const [bi, bj] of blocks) {
          if (ai === bi && aj === bj) continue;
          expect(Math.max(Math.abs(ai - bi), Math.abs(aj - bj))).toBeGreaterThan(PROPS.buildingGap);
        }
    }
    expect(found).toBeGreaterThan(20);
  });

  it('alrededor de un edificio no hay objetos ni ácido', () => {
    let ring = 0;
    for (let seed = 1; seed < 5; seed++)
      for (let bj = -SPAN; bj < SPAN; bj++)
        for (let bi = -SPAN; bi < SPAN; bi++) {
          if (!buildingBlock(seed, bi, bj, 0, 0)) continue;
          const c = PROPS.clearance;
          for (let j = bj * B - c; j < (bj + 1) * B + c; j++)
            for (let i = bi * B - c; i < (bi + 1) * B + c; i++) {
              const inside = i >= bi * B && i < (bi + 1) * B && j >= bj * B && j < (bj + 1) * B;
              if (inside) continue;
              ring++;
              expect(nearBuilding(seed, i, j, 0, 0)).toBe(true);
              expect(hazardAt(seed, i, j, 0, 0)).toBe(-1);
              expect(objectAt(seed, i, j, 0, 0, cell)).toBe(false);
            }
        }
    expect(ring).toBeGreaterThan(100);
  });

  it('las zonas de objetivo caen en un sitio despejado', () => {
    let clear = 0;
    const N = 30;
    for (let seed = 1; seed <= N; seed++) {
      const w = createWorld('dot', seed, { startWeapon: null });
      w.nextObjective = 0;
      tick(w, { moveX: 0, moveY: 0 } as never, STEP);
      const o = w.objective!;
      expect(o).not.toBeNull();
      const c = areaClutter(w, o.x, o.y, o.r);
      expect(c).toBeLessThan(BUILDING_WEIGHT);
      if (c === 0) clear++;
    }
    expect(clear).toBeGreaterThanOrEqual(N * 0.85);
  });
});

describe('cofres a la vista', () => {
  const spot = { x: 0, y: 0 };

  it('dentro o detrás de un edificio pasan a la esquina delantera o a la derecha', () => {
    const { w, x, y } = worldWithBuilding('raiders');
    const O = BUILDINGS.cache.offset;
    for (const [dx, dy] of [
      [0, 0],
      [-200, -200],
      [-400, -100],
      [100, -150],
    ] as const) {
      chestSpot(w, x + dx, y + dy, spot);
      expect(spot.x).toBeCloseTo(x + O);
      expect(Math.abs(spot.y - y)).toBeCloseTo(O);
    }
  });

  it('delante de un edificio se quedan donde caen', () => {
    const { w, x, y } = worldWithBuilding('raiders');
    const O = BUILDINGS.cache.offset;
    chestSpot(w, x + O, y + O, spot);
    expect(spot).toEqual({ x: x + O, y: y + O });
    chestSpot(w, x + O, y - O, spot);
    expect(spot).toEqual({ x: x + O, y: y - O });
  });

  it('las cajas del supermercado salen entre la derecha y la esquina delantera, sin amontonarse', () => {
    const { w, x, y } = worldWithBuilding('supply');
    w.player.x = x + 300;
    w.player.y = y + 300;
    tick(w, { moveX: 0, moveY: 0 } as never, STEP);
    const crates = w.pickups.items.slice(0, w.pickups.count).filter((k) => k.kind === 'crate');
    expect(crates.length).toBeGreaterThanOrEqual(BUILDINGS.crates.min);
    for (const k of crates) {
      const u = k.x - x - (k.y - y);
      const v = k.x - x + (k.y - y);
      expect(u).toBeGreaterThan(-1);
      expect(v + Math.abs(u)).toBeGreaterThan(BUILDINGS.chest.hideFront);
      expect(k.x).toBeGreaterThan(x);
    }
    expect(new Set(crates.map((k) => `${k.x},${k.y}`)).size).toBe(crates.length);
  });
});
