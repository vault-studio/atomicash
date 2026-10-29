// Dossier fase 2: élites, hordas en formación, avisos de los jefes y racha de bajas.
import { describe, expect, it } from 'vitest';
import { AI, ELITES, ENEMY_STATS } from '../src/config/enemies';
import { RUN, STREAK, XP, streakMult } from '../src/config/run';
import { HORDES } from '../src/config/waves';
import { addPickup, hitEnemy, hurtPlayer, killEnemy } from '../src/engine/systems/combat';
import { spawnEnemy } from '../src/engine/systems/enemies';
import { announceHorde, spawnElite } from '../src/engine/systems/spawning';
import type { Enemy, InputState, World } from '../src/engine/types';
import { isOnScreen } from '../src/engine/view';
import { createWorld, tick } from '../src/engine/world';

const STEP = 1 / RUN.tickHz;
const STILL: InputState = { moveX: 0, moveY: 0 };

function quiet(seed = 1): World {
  const w = createWorld('dot', seed, { startWeapon: null, hazards: false });
  w.nextEvent = Infinity;
  w.nextElite = Infinity;
  w.nextHorde = Infinity;
  w.spawnAcc = -1e9;
  w.player.god = true;
  for (const k of ['rey_rata', 'dirigible', 'coloso']) w.bossSpawned[k] = true;
  return w;
}

const run = (w: World, sec: number): void => {
  for (let i = 0; i < Math.round(sec * RUN.tickHz); i++) {
    w.spawnAcc = -1e9;
    tick(w, STILL, STEP);
  }
};

const alive = (w: World): Enemy[] => w.enemies.items.slice(0, w.enemies.count).filter((e) => !e.dead);

describe('élites', () => {
  it('aparecen solos cada 60–90 s', () => {
    const w = quiet();
    w.nextElite = ELITES.first;
    run(w, ELITES.first + 1);
    expect(alive(w).filter((e) => e.elite)).toHaveLength(1);
    expect(w.nextElite).toBeGreaterThanOrEqual(ELITES.first + ELITES.everyMin);
    expect(w.nextElite).toBeLessThanOrEqual(ELITES.first + ELITES.everyMax + 1);
  });

  it('son más duros, sueltan cofre especial y llenan la barra del HUD al golpearlos', () => {
    const w = quiet();
    const e = spawnElite(w);
    expect(e.elite).not.toBeNull();
    expect(e.maxHp).toBeCloseTo(ENEMY_STATS[e.type].hp * (1 + w.time / 250) * ELITES.hp);
    hitEnemy(w, e, 1, 'llave', 4);
    expect(w.eliteFocus).toBe(e.id);
    killEnemy(w, e, 'llave');
    const caches = w.pickups.items.slice(0, w.pickups.count).filter((k) => k.kind === 'cache');
    expect(caches).toHaveLength(1);
  });

  it('el blindado recibe la mitad de daño y el divisor se parte al morir', () => {
    const w = quiet();
    const e = spawnEnemy(w, 'saqueador', w.player.x + 300, w.player.y);
    e.elite = 'blindado';
    expect(hitEnemy(w, e, 10, 'llave', 4)).toBe(10 * ELITES.blindado.dmgTaken);
    e.elite = 'divisor';
    killEnemy(w, e, 'llave');
    expect(alive(w).filter((o) => o.type === 'saqueador')).toHaveLength(ELITES.divisor.split);
  });
});

describe('hordas en formación', () => {
  for (const kind of HORDES.order) {
    it(`${kind}: avisa y llega fuera de cámara tras el aviso`, () => {
      const w = quiet();
      announceHorde(w, kind);
      expect(w.horde?.kind).toBe(kind);
      run(w, HORDES.warn - 0.1);
      expect(alive(w)).toHaveLength(0);
      const before = w.nextId;
      run(w, 0.2);
      const fresh = alive(w).filter((e) => e.id >= before);
      expect(w.horde).toBeNull();
      expect(fresh.length).toBeGreaterThanOrEqual(HORDES[kind].count);
      expect(fresh.filter((e) => isOnScreen(w, e.prevX, e.prevY))).toEqual([]);
      if (kind !== 'ring') expect(fresh.every((e) => e.march > 0)).toBe(true);
    });
  }

  it('la estampida sigue recta aunque el jugador no esté en su camino', () => {
    const w = quiet();
    announceHorde(w, 'stampede');
    run(w, HORDES.warn + 0.05);
    const e = alive(w)[0]!;
    const dx = e.dx;
    const dy = e.dy;
    w.player.x += 500;
    run(w, 0.5);
    expect(e.dx).toBe(dx);
    expect(e.dy).toBe(dy);
  });
});

describe('avisos de los jefes', () => {
  it('el Rey Rata marca el pasillo de su embestida y en fase 2 embiste dos veces', () => {
    const w = quiet();
    const e = spawnEnemy(w, 'rey_rata', w.player.x + 200, w.player.y);
    e.alt = true;
    e.timer = 0;
    run(w, STEP);
    const lane = w.tele.items.slice(0, w.tele.count).find((t) => t.lx !== 0 || t.ly !== 0);
    expect(lane).toBeDefined();
    expect(lane!.dmg).toBe(0);

    e.hp = e.maxHp * 0.4;
    e.mode = 0;
    e.alt = true;
    e.timer = 0;
    w.tele.clear();
    run(w, STEP * 2);
    expect(e.phase).toBe(2);
    expect(e.burst).toBe(1);
    run(w, AI.rey_rata.aimP2 + AI.rey_rata.dash + STEP * 2);
    // Segunda embestida: otro pasillo.
    expect(w.tele.count).toBeGreaterThan(0);
  });
});

describe('cinemática de victoria', () => {
  it('la pide la máquina de cupones al recogerla, no las bajas de élites ni de jefes', () => {
    const w = quiet();
    killEnemy(w, spawnElite(w), 'llave');
    killEnemy(w, spawnEnemy(w, 'rey_rata', w.player.x + 300, w.player.y), 'llave');
    expect(w.victory).toBe(false);
    addPickup(w, 'cache', w.player.x, w.player.y, 10);
    tick(w, STILL, STEP);
    expect(w.victory).toBe(true);
    expect(w.choice?.type).toBe('cache');
  });
});

describe('racha de bajas', () => {
  it('multiplica la experiencia por tramos y se pierde al recibir un golpe', () => {
    expect(streakMult(0)).toBe(1);
    expect(streakMult(100)).toBe(1.5);
    expect(streakMult(300)).toBe(2);
    const w = quiet();
    w.player.god = false;
    w.streak = STREAK.tiers[1]!.at;
    const e = spawnEnemy(w, 'necrofago', w.player.x + 300, w.player.y, false);
    killEnemy(w, e, 'llave');
    const gems = w.pickups.items.slice(0, w.pickups.count).filter((k) => k.kind === 'gem');
    const total = gems.reduce((s, k) => s + k.val, 0);
    expect(total).toBe(Math.round(ENEMY_STATS.necrofago.xp * XP.killMult * 1.5));
    expect(w.bestStreak).toBe(STREAK.tiers[1]!.at + 1);
    hurtPlayer(w, 5);
    expect(w.streak).toBe(0);
    expect(w.bestStreak).toBe(STREAK.tiers[1]!.at + 1);
  });
});
