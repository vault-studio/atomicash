// Destrozos del mapa: el mortero y las lluvias rompen el suelo o dejan lagos de ácido.
import { describe, expect, it } from 'vitest';
import { AI } from '../src/config/enemies';
import { RAINS } from '../src/config/modes';
import { PROP_LIST, PROP_SHAPES, RUBBLE_PROPS } from '../src/config/props';
import { HAZARDS, RAD } from '../src/config/radiation';
import { RUN } from '../src/config/run';
import { SPAWN } from '../src/config/waves';
import { cellKey, nearBuilding, worldHazardAt } from '../src/engine/hazards';
import {
  areaClutter,
  blockCircle,
  createCellObject,
  hitsObstacle,
  worldObjectAt,
} from '../src/engine/obstacles';
import { addAcid, addRubble, markFall, scarFree } from '../src/engine/scars';
import { addChest, killEnemy } from '../src/engine/systems/combat';
import { spawnEnemy } from '../src/engine/systems/enemies';
import { startDownpour, updateDownpour } from '../src/engine/systems/rains';
import { launchSalvo } from '../src/engine/systems/shooters';
import { hurtIndex } from '../src/engine/runStats';
import type { World } from '../src/engine/types';
import { createWorld, tick } from '../src/engine/world';

const T = RUN.groundCell;
const STEP = 1 / 60;
const idle = { moveX: 0, moveY: 0 } as never;

function freshWorld(seed = 1): World {
  const w = createWorld('dot', seed, { startWeapon: null });
  w.nextHorde = w.nextElite = w.nextEvent = w.nextObjective = w.nextDownpour = Infinity;
  w.player.god = true;
  tick(w, idle, STEP);
  return w;
}

/** Casilla libre a la derecha del jugador, a `dist` casillas como mínimo. */
function freeCell(w: World, dist = 2): { i: number; j: number; x: number; y: number } {
  const c0 = Math.floor(w.player.x / T);
  const c1 = Math.floor(w.player.y / T);
  for (let i = c0 + dist; i < c0 + 12; i++)
    for (let j = c1 - 6; j < c1 + 6; j++)
      if (scarFree(w, i, j)) return { i, j, x: (i + 0.5) * T, y: (j + 0.5) * T };
  throw new Error('sin casilla libre');
}

describe('escombros', () => {
  it('los montones del suelo roto existen y dejan paso al jugador', () => {
    expect(RUBBLE_PROPS.length).toBeGreaterThan(0);
    const w = freshWorld();
    for (const k of RUBBLE_PROPS) {
      expect(PROP_LIST[k]!.cells).toBe(1);
      expect(PROP_SHAPES[k]!.r + RAINS.rubbleInset).toBeLessThanOrEqual(T / 2);
    }
    expect(RAINS.rubbleInset * 2).toBeGreaterThan(w.player.r * 2);
  });

  it('cada impacto del mortero deja un obstáculo que frena al jugador y a las balas', () => {
    const w = freshWorld();
    const c = freeCell(w);
    w.player.x = c.x - T * 2;
    w.player.y = c.y;
    w.player.facingX = 1;
    w.player.facingY = 0;
    tick(w, idle, STEP);
    markFall(w, c.x, c.y, AI.mortero.shellR, 0.05, AI.mortero.shellDmg, 0, hurtIndex('mortero'), 'shell');
    for (let k = 0; k < 8; k++) tick(w, idle, STEP);
    expect(w.scars.get(cellKey(c.i, c.j))?.kind).toBe('rubble');
    expect(hitsObstacle(w, c.x, c.y)).toBe(true);
    const o = { x: c.x, y: c.y };
    blockCircle(w, o, w.player.r, 0, 0, 1);
    expect(Math.hypot(o.x - c.x, o.y - c.y)).toBeGreaterThan(w.player.r);
    expect(w.rs.shellsDodged).toBe(1);
  });

  it('una salva entera rompe el suelo por donde cae', () => {
    const w = freshWorld();
    const c = freeCell(w);
    w.player.x = c.x;
    w.player.y = c.y;
    w.player.facingX = 1;
    w.player.facingY = 0;
    tick(w, idle, STEP);
    const n = launchSalvo(w, hurtIndex('mortero'));
    for (let k = 0; k < 3 * 60; k++) tick(w, idle, STEP);
    expect(n).toBe(AI.mortero.shells);
    expect(w.tele.count).toBe(0);
    expect([...w.scars.values()].filter((s) => s.kind === 'rubble').length).toBeGreaterThan(0);
  });

  it('en cada casilla cabe uno, y siguen separados aunque caigan en el borde', () => {
    const w = freshWorld();
    const c = freeCell(w);
    expect(addRubble(w, c.i * T + 118, c.j * T + 60)).toBe(true);
    expect(addRubble(w, c.i * T + 20, c.j * T + 60)).toBe(false);
    if (addRubble(w, (c.i + 1) * T + 2, c.j * T + 60)) {
      const a = w.scars.get(cellKey(c.i, c.j))!;
      const b = w.scars.get(cellKey(c.i + 1, c.j))!;
      const gap = b.x - a.x - PROP_SHAPES[a.v]!.r - PROP_SHAPES[b.v]!.r;
      expect(gap).toBeGreaterThanOrEqual(RAINS.rubbleInset * 2 - 1e-6);
    }
  });

  it('el render ve los escombros como un objeto más', () => {
    const w = freshWorld();
    const c = freeCell(w);
    addRubble(w, c.x, c.y);
    const out = createCellObject();
    expect(worldObjectAt(w, c.i, c.j, out)).toBe(true);
    expect(RUBBLE_PROPS).toContain(out.prop);
    expect(areaClutter(w, c.x, c.y, 10)).toBe(1);
  });
});

describe('dónde no caen destrozos', () => {
  it('ni junto a un edificio', () => {
    for (let seed = 1; seed < 40; seed++) {
      const w = freshWorld(seed);
      const b = w.buildings[0];
      if (!b) continue;
      const i = Math.floor(b.x / T);
      const j = Math.floor(b.y / T);
      expect(nearBuilding(w.seed, i, j, w.start.x, w.start.y)).toBe(true);
      expect(addRubble(w, b.x, b.y)).toBe(false);
      expect(addAcid(w, i, j, 0)).toBe(false);
      return;
    }
    throw new Error('ninguna semilla con edificio');
  });

  it('ni en la zona de un objetivo', () => {
    const w = freshWorld();
    const c = freeCell(w);
    w.objective = { kind: 'hold', x: c.x, y: c.y, r: 150, progress: 0, goal: 12, left: 50 };
    expect(scarFree(w, c.i, c.j)).toBe(false);
    w.objective = null;
    expect(scarFree(w, c.i, c.j)).toBe(true);
  });

  it('ni donde hay un cofre', () => {
    const w = freshWorld();
    const c = freeCell(w);
    addChest(w, 'chest', c.x, c.y, 16);
    const k = w.pickups.items[w.pickups.count - 1]!;
    expect(scarFree(w, Math.floor(k.x / T), Math.floor(k.y / T))).toBe(false);
  });

  it('sin mapa (pruebas) no hay destrozos', () => {
    const w = createWorld('dot', 1, { startWeapon: null, hazards: false });
    expect(addRubble(w, 500, 500)).toBe(false);
    w.nextDownpour = 0;
    updateDownpour(w, STEP);
    expect(w.downpour).toBeNull();
  });
});

describe('lagos de ácido', () => {
  it('la gota deja un lago que irradia, en su casilla y del radio marcado', () => {
    const w = freshWorld();
    const c = freeCell(w);
    const r = T * HAZARDS.cellRadii[1]!;
    markFall(w, c.x, c.y, r, 0.05, 8, 12, hurtIndex('acido'), 'acid', 1);
    for (let k = 0; k < 8; k++) tick(w, idle, STEP);
    expect(worldHazardAt(w, c.i, c.j)).toBe(1);
    expect(w.hazards.some((h) => h.x === c.x && h.y === c.y && h.r === r)).toBe(true);
    w.player.x = c.x;
    w.player.y = c.y;
    w.player.rad = 0;
    for (let k = 0; k < 30; k++) tick(w, idle, STEP);
    expect(w.player.rad).toBeGreaterThan(RAD.puddle * 0.3);
  });

  it('una gota que cae encima irradia al momento', () => {
    const w = freshWorld();
    w.player.god = false;
    w.player.inv = 0;
    const c = freeCell(w);
    w.player.x = c.x;
    w.player.y = c.y;
    w.player.rad = 0;
    markFall(w, c.x, c.y, 50, 0.05, 8, 12, hurtIndex('acido'), 'acid', 1);
    for (let k = 0; k < 6; k++) tick(w, idle, STEP);
    expect(w.player.rad).toBeGreaterThanOrEqual(11);
  });
});

describe('los enemigos también cambian el mapa', () => {
  it('el hinchado deja varias losetas de ácido juntas al reventar', () => {
    const w = freshWorld();
    const c = freeCell(w, 3);
    const e = spawnEnemy(w, 'hinchado', c.x, c.y, false);
    killEnemy(w, e, 'llave');
    tick(w, idle, STEP);
    const lakes = [...w.scars.entries()].filter(([, s]) => s.kind === 'acid');
    expect(lakes.length).toBe(AI.hinchado.acidCells);
    for (const [, s] of lakes) {
      expect(Math.abs(s.x - c.x)).toBeLessThanOrEqual(T + 1);
      expect(Math.abs(s.y - c.y)).toBeLessThanOrEqual(T + 1);
      expect(s.v).toBe(HAZARDS.cellRadii.length - 1);
    }
    expect(worldHazardAt(w, c.i, c.j)).toBeGreaterThanOrEqual(0);
  });

  it('las bombas del dirigible rompen el suelo', () => {
    const w = freshWorld();
    spawnEnemy(w, 'dirigible', w.player.x + 300, w.player.y, false);
    for (let k = 0; k < 14 * 60 && w.scars.size === 0; k++) tick(w, idle, STEP);
    const list = [...w.scars.values()];
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((s) => s.kind === 'rubble')).toBe(true);
  });

  it('los esbirros del rey rata salen alrededor del jugador', () => {
    const w = freshWorld();
    const p = w.player;
    const boss = spawnEnemy(w, 'rey_rata', p.x + 1200, p.y, false);
    boss.burst = 0;
    boss.timer = 0;
    tick(w, idle, STEP);
    const drones = w.enemies.items.slice(0, w.enemies.count).filter((e) => e.type === AI.rey_rata.summonType);
    expect(drones.length).toBe(AI.rey_rata.summon);
    for (const e of drones) expect(Math.hypot(e.x - p.x, e.y - p.y)).toBeCloseTo(AI.rey_rata.summonDist, -1);
  });

  it('el rastro de la babosa dura un minuto', () => {
    const w = freshWorld();
    const e = spawnEnemy(w, 'babosa', w.player.x + 400, w.player.y, false);
    e.trail = 0;
    tick(w, idle, STEP);
    expect(w.slimes.count).toBe(1);
    expect(w.slimes.items[0]!.life).toBeCloseTo(60, 0);
    e.dead = true;
    w.enemies.count = 0;
    for (let k = 0; k < 59 * 60; k++) tick(w, idle, STEP);
    expect(w.slimes.count).toBeGreaterThanOrEqual(1);
    for (let k = 0; k < 2 * 60; k++) tick(w, idle, STEP);
    expect(w.slimes.count).toBe(0);
  });
});

describe('lluvias', () => {
  const run = (w: World, s: number): void => {
    for (let k = 0; k < s * 60; k++) tick(w, idle, STEP);
  };

  it('la de chatarra rompe el suelo alrededor del jugador y se acaba', () => {
    const w = freshWorld();
    startDownpour(w, 'scrap');
    run(w, RAINS.scrap.dur + 3);
    expect(w.downpour).toBeNull();
    const list = [...w.scars.values()];
    expect(list.every((s) => s.kind === 'rubble')).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(8);
    for (const s of list)
      expect(Math.hypot(s.x - w.player.x, s.y - w.player.y)).toBeLessThan(RAINS.scrap.radius + T);
  });

  it('la de ácido deja lagos nuevos, en el centro de su casilla', () => {
    const w = freshWorld();
    startDownpour(w, 'acid');
    run(w, RAINS.acid.dur + 3);
    const list = [...w.scars.values()];
    expect(list.length).toBeGreaterThanOrEqual(20);
    for (const s of list) {
      expect(s.kind).toBe('acid');
      expect(s.x % T).toBeCloseTo(T / 2);
      expect(s.y % T).toBeCloseTo(T / 2);
    }
  });

  it('caen a las 0:30, 2:40 y 5:10, por turnos, aunque haya jefe', () => {
    const w = freshWorld();
    const seen: [number, string][] = [];
    w.nextDownpour = RAINS.times[0]!;
    w.bossAlive = 1;
    for (const at of RAINS.times) {
      w.time = at - 1;
      updateDownpour(w, STEP);
      expect(w.downpour).toBeNull();
      w.time = at;
      updateDownpour(w, STEP);
      seen.push([at, w.downpour!.kind]);
      w.downpour = null;
    }
    expect(seen).toEqual([
      [30, 'scrap'],
      [160, 'acid'],
      [310, 'scrap'],
    ]);
  });

  it('las de después de las horas fijas esperan a que pase el jefe', () => {
    const w = freshWorld();
    w.downpourIdx = RAINS.times.length;
    w.nextDownpour = 0;
    w.bossAlive = 1;
    updateDownpour(w, STEP);
    expect(w.downpour).toBeNull();
    w.bossAlive = 0;
    w.nextDownpour = 0;
    w.time = 1000;
    updateDownpour(w, STEP);
    expect(w.downpour).not.toBeNull();
    expect(w.nextDownpour).toBeGreaterThanOrEqual(w.time + RAINS.everyMin);
  });

  it('con un jefe vivo siguen saliendo enemigos, a la mitad de ritmo', () => {
    const count = (boss: boolean): number => {
      const w = createWorld('dot', 1, { startWeapon: null, hazards: false });
      w.player.god = true;
      w.nextHorde = w.nextElite = w.nextEvent = w.nextObjective = Infinity;
      w.bossAlive = boss ? 1 : 0;
      for (let k = 0; k < 30 * 60; k++) tick(w, idle, STEP);
      return w.enemies.count;
    };
    const normal = count(false);
    const conJefe = count(true);
    expect(normal).toBeGreaterThan(20);
    expect(conJefe / normal).toBeCloseTo(SPAWN.bossRateMult, 1);
  });

  it('con la misma semilla cae lo mismo', () => {
    const a = freshWorld(5);
    const b = freshWorld(5);
    startDownpour(a, 'scrap');
    startDownpour(b, 'scrap');
    run(a, 6);
    run(b, 6);
    expect([...a.scars.entries()]).toEqual([...b.scars.entries()]);
  });
});
