// F2-03…F2-07: enemigos con IA, irradiados, RAD, jefes, Tormenta, objetos y eventos.
import { describe, expect, it } from 'vitest';
import { ACT_IDS, CAMPAIGN } from '../src/config/acts';
import { AI, ENEMY_STATS } from '../src/config/enemies';
import { ITEMS } from '../src/config/items';
import { IRRADIATED, RAD, radTier } from '../src/config/radiation';
import { RUN, XP } from '../src/config/run';
import { EVENTS } from '../src/config/waves';
import { hitEnemy, irradiatedChance, killEnemy } from '../src/engine/systems/combat';
import { spawnEnemy } from '../src/engine/systems/enemies';
import { applyChoice, consumeItem, openItemChoice, updatePickups } from '../src/engine/systems/progression';
import type { Enemy, InputState, World } from '../src/engine/types';
import { createWorld, tick } from '../src/engine/world';

const STEP = 1 / RUN.tickHz;
const STILL: InputState = { moveX: 0, moveY: 0 };

function quiet(charId: 'dot' | 'errante' | 'mae' = 'dot', seed = 1): World {
  const w = createWorld(charId, seed, { startWeapon: null, hazards: false });
  w.nextElite = Infinity;
  w.nextSpecial = Infinity;
  w.spawnAcc = -1e9;
  for (const k of ['rey_rata', 'dirigible', 'coloso']) w.bossSpawned[k] = true;
  return w;
}

const run = (w: World, sec: number, input = STILL): void => {
  for (let i = 0; i < Math.round(sec * RUN.tickHz); i++) tick(w, input, STEP);
};

const alive = (w: World): Enemy[] => w.enemies.items.slice(0, w.enemies.count).filter((e) => !e.dead);

describe('radiación (02_GAMEPLAY.md §6)', () => {
  it('tramos 0–29, 30–59, 60–89 y 90–100', () => {
    expect(radTier(29.9).dmg).toBe(0);
    expect(radTier(30)).toMatchObject({ dmg: 0.1, hpPen: 0.05 });
    expect(radTier(60)).toMatchObject({ dmg: 0.25, hpPen: 0.15 });
    expect(radTier(60).irr).toBeGreaterThan(0);
    expect(radTier(90)).toMatchObject({ dmg: 0.4, drain: 1 });
  });

  it('da daño a cambio de PV máximos y drena vida a partir de 90', () => {
    const w = quiet();
    const base = { dmg: w.st.dmgMult, hp: w.st.maxHp };
    w.player.rad = 65;
    tick(w, STILL, STEP);
    expect(w.st.dmgMult).toBeCloseTo(base.dmg * 1.25);
    expect(w.st.maxHp).toBe(Math.round(base.hp * 0.85));
    w.player.rad = 95;
    const hp = w.player.hp;
    run(w, 1);
    expect(hp - w.player.hp).toBeCloseTo(1, 0);
  });

  it('sube en los charcos, no baja sola y solo la quitan el yodo o los rasgos', () => {
    const w = createWorld('dot', 1, { startWeapon: null });
    w.spawnAcc = -1e9;
    const h = w.hazards[0]!;
    w.player.x = h.x;
    w.player.y = h.y;
    run(w, 2);
    expect(w.player.rad).toBeCloseTo(RAD.puddle * 2, 0);
    w.player.x = w.player.y = RUN.mapSize / 2;
    const peak = w.player.rad;
    run(w, 10);
    expect(w.player.rad).toBe(peak);
    w.tr.radDecay = 1;
    run(w, 2);
    expect(w.player.rad).toBeCloseTo(peak - 2, 0);
    expect(consumeItem(w, 1)).toBe(true);
    expect(w.player.rad).toBe(0);
  });

  it('el Errante recibe un 30 % menos', () => {
    const a = quiet('dot');
    const b = quiet('errante');
    for (const w of [a, b]) {
      w.rain = 5;
      run(w, 1);
    }
    expect(b.player.rad / a.player.rad).toBeCloseTo(0.7, 2);
  });
});

describe('bolitas de experiencia', () => {
  it('un enemigo normal suelta una sola bolita con toda su experiencia', () => {
    const w = quiet();
    killEnemy(w, spawnEnemy(w, 'saqueador', 0, 0, false), 'llave');
    expect(w.pickups.count).toBe(XP.killGems);
    expect(w.pickups.items[0]!.val).toBe(Math.round(ENEMY_STATS.saqueador.xp * XP.killMult));
  });
});

describe('irradiados', () => {
  it('más PV, el doble de chatarra y su golpe da RAD', () => {
    const w = quiet();
    const n = spawnEnemy(w, 'saqueador', 0, 0, false);
    const i = spawnEnemy(w, 'saqueador', 0, 0, true);
    expect(i.maxHp).toBeCloseTo(n.maxHp * IRRADIATED.hp);
    killEnemy(w, i, 'llave');
    const xp = w.pickups.items.slice(0, w.pickups.count).reduce((s, k) => s + k.val, 0);
    // Las bolitas valen enteros: el total se redondea.
    expect(xp).toBe(Math.round(ENEMY_STATS.saqueador.xp * XP.killMult * IRRADIATED.xp));
    expect(w.pickups.count).toBe(XP.rareGems);
    const r = spawnEnemy(w, 'necrofago', w.player.x + 5, w.player.y, true);
    r.atkCd = 0;
    tick(w, STILL, STEP);
    expect(w.player.rad).toBeGreaterThan(0);
  });

  it('salen más a menudo con el tiempo y con mucha RAD', () => {
    const w = quiet();
    const c0 = irradiatedChance(w);
    w.player.rad = 70;
    expect(irradiatedChance(w)).toBeGreaterThan(c0);
  });
});

describe('IA de enemigos (03_CONTENT.md)', () => {
  it('el tirador se acerca hasta tenerte a tiro y se planta a disparar', () => {
    const w = quiet();
    w.player.god = true;
    const e = spawnEnemy(w, 'tirador', w.player.x + AI.tirador.hold + 200, w.player.y, false);
    run(w, 6);
    const d = Math.hypot(e.x - w.player.x, e.y - w.player.y);
    expect(d).toBeLessThanOrEqual(AI.tirador.hold + 5);
    const { x, y } = e;
    run(w, 2);
    expect(Math.hypot(e.x - x, e.y - y)).toBeLessThan(5);
    expect(w.ebullets.count + (w.player.lastHit > 0 ? 1 : 0)).toBeGreaterThan(0);
  });

  it('plantado, el tirador no vuelve a andar por un paso que des, solo si te alejas `resume`', () => {
    const w = quiet();
    w.player.god = true;
    const e = spawnEnemy(w, 'tirador', w.player.x + AI.tirador.hold + 200, w.player.y, false);
    run(w, 6);
    expect(e.moving).toBe(false);
    w.player.x -= AI.tirador.resume / 2;
    run(w, 1);
    expect(e.moving).toBe(false);
    w.player.x -= AI.tirador.resume;
    tick(w, STILL, STEP);
    expect(e.moving).toBe(true);
  });

  it('el hinchado explota al morir y daña a los suyos', () => {
    const w = quiet();
    const { x, y } = w.player;
    const b = spawnEnemy(w, 'hinchado', x + 300, y, false);
    const o = spawnEnemy(w, 'dron', x + 330, y, false);
    killEnemy(w, b, 'llave');
    tick(w, STILL, STEP);
    expect(o.dead || o.hp < o.maxHp).toBe(true);
  });

  it('la aspiradora suelta 4 crías', () => {
    const w = quiet();
    const a = spawnEnemy(w, 'aspiradora', 400, 400, false);
    killEnemy(w, a, 'llave');
    expect(alive(w).filter((e) => e.type === 'aspiradora_cria')).toHaveLength(AI.aspiradora.children);
  });

  it('la babosa deja rastro radiactivo', () => {
    const w = quiet();
    spawnEnemy(w, 'babosa', w.player.x + 300, w.player.y, false);
    run(w, 2);
    expect(w.slimes.count).toBeGreaterThan(2);
  });

  it('el cortacésped apunta y embiste', () => {
    const w = quiet();
    w.player.god = true;
    const e = spawnEnemy(w, 'cortacesped', w.player.x + 300, w.player.y, false);
    let maxSpeed = 0;
    for (let i = 0; i < 6 * 60; i++) {
      const x = e.x;
      tick(w, STILL, STEP);
      maxSpeed = Math.max(maxSpeed, Math.abs(e.x - x) / STEP);
    }
    expect(maxSpeed).toBeGreaterThan(ENEMY_STATS.cortacesped.dash!.speed * 0.9);
  });

  it('la torreta no se mueve y dispara ráfagas', () => {
    const w = quiet();
    w.player.god = true;
    const e = spawnEnemy(w, 'torreta', w.player.x + 300, w.player.y, false);
    let shots = 0;
    for (let i = 0; i < 4 * RUN.tickHz; i++) {
      run(w, STEP);
      shots = Math.max(shots, e.burst + w.ebullets.count);
    }
    expect(e.x).toBe(w.player.x + 300);
    expect(shots).toBeGreaterThan(0);
  });
});

describe('jefes y Tormenta (F2-05)', () => {
  it('cada acto saca su jefe a su hora, solo por tiempo', () => {
    for (const act of ACT_IDS) {
      const w = createWorld('dot', 1, { startWeapon: null, hazards: false, act });
      w.player.god = true;
      w.kills = 100_000;
      w.time = CAMPAIGN.bossAt - 2 * STEP;
      tick(w, STILL, STEP);
      expect(w.bossAlive).toBe(0);
      w.time = CAMPAIGN.bossAt;
      tick(w, STILL, STEP);
      expect(alive(w).some((e) => e.type === CAMPAIGN.acts[act].boss)).toBe(true);
      expect(w.bossAlive).toBe(1);
    }
  });

  it('el Rey Rata invoca necrófagos y suelta un cofre', () => {
    const w = quiet();
    w.player.god = true;
    const b = spawnEnemy(w, 'rey_rata', w.player.x + 200, w.player.y, false);
    run(w, AI.rey_rata.every + 0.5);
    expect(alive(w).filter((e) => e.type === AI.rey_rata.summonType).length).toBeGreaterThan(0);
    expect(AI.rey_rata.summonType).toBe('necrofago');
    killEnemy(w, b, 'llave');
    expect(w.pickups.items.slice(0, w.pickups.count).some((k) => k.kind === 'chest')).toBe(true);
    expect(w.bosses).toBe(1);
  });

  it('el Coloso cambia de fase y al morir da la victoria', () => {
    const w = quiet();
    w.player.god = true;
    const c = spawnEnemy(w, 'coloso', w.player.x + 400, w.player.y, false);
    c.hp = c.maxHp * 0.5;
    tick(w, STILL, STEP);
    expect(c.phase).toBe(2);
    c.hp = c.maxHp * 0.2;
    tick(w, STILL, STEP);
    expect(c.phase).toBe(3);
    hitEnemy(w, c, 1e9, 'llave', 0x4);
    expect(w.won).toBe(true);
    // Antes de terminar pregunta si seguir en el modo infinito.
    expect(w.choice?.type).toBe('endless');
    applyChoice(w, 1);
    expect(w.over).toBe(true);
  });

  it('los telegrafiados del dirigible dejan torretas', () => {
    const w = quiet();
    w.player.god = true;
    spawnEnemy(w, 'dirigible', w.player.x + 320, w.player.y, false);
    run(w, AI.dirigible.every + AI.dirigible.paraWarn + 0.5);
    expect(alive(w).some((e) => e.type === 'torreta')).toBe(true);
  });

  it('la Tormenta mata al acabar el tiempo', () => {
    const w = quiet();
    w.time = RUN.stormStart;
    run(w, 30);
    expect(w.storm).toBe(true);
    expect(w.player.deadAt).not.toBeNull();
  });
});

describe('objetos y eventos (F2-06/F2-07)', () => {
  it('el cofre de jefe ofrece 3 objetos que no lleva; caben 2 y se suman', () => {
    const w = quiet();
    openItemChoice(w);
    const cards = w.choice!.cards;
    expect(cards).toHaveLength(3);
    expect(cards.every((c) => c.kind === 'item')).toBe(true);
    const speed = w.st.speed;
    w.choice = { type: 'item', cards: [{ kind: 'item', id: 'skates' }] };
    applyChoice(w, 0);
    expect(w.items).toEqual(['skates']);
    expect(w.st.speed).toBeCloseTo(speed * (1 + ITEMS.skates.speed));
    openItemChoice(w);
    expect(w.choice!.cards.some((c) => c.kind === 'item' && c.id === 'skates')).toBe(false);
    const dmg = w.st.dmgMult;
    w.choice = { type: 'item', cards: [{ kind: 'item', id: 'bobble' }] };
    applyChoice(w, 0);
    expect(w.items).toEqual(['skates', 'bobble']);
    expect(w.st.dmgMult).toBeCloseTo(dmg * (1 + ITEMS.bobble.dmg));
    expect(w.st.speed).toBeCloseTo(speed * (1 + ITEMS.skates.speed));
    // Sin hueco libre no se abre otro cofre.
    openItemChoice(w);
    expect(w.choice).toBeNull();
  });

  it('la caja de suministros da chatarra y un consumible', () => {
    const w = quiet();
    const total = (): number => Object.values(w.cons).reduce((a, b) => a + b, 0);
    const n = total();
    const k = w.pickups.acquire();
    Object.assign(k, { kind: 'crate', val: 0, x: w.player.x, y: w.player.y, r: 16, pull: false, sp: 0 });
    updatePickups(w, STEP);
    expect(total()).toBe(n + 1);
    expect(w.gemCount).toBe(EVENTS.supply.gems);
  });
});
