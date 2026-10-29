// Dossier fase 2: élites, hordas en formación, avisos de los jefes y racha de bajas.
import { describe, expect, it } from 'vitest';
import { AI, ELITES, ENEMY_STATS } from '../src/config/enemies';
import { RUN, STREAK, XP, streakMult } from '../src/config/run';
import { HORDES } from '../src/config/waves';
import { addPickup, addRad, hitEnemy, hurtPlayer, killEnemy } from '../src/engine/systems/combat';
import { IRRADIATED, RAD } from '../src/config/radiation';
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
  it('el Rey Rata llama a las ratas parado y luego encadena embestidas avisadas, más en fase 2', () => {
    const R = AI.rey_rata;
    // Cuenta los pasillos de embestida nuevos (los avisos sin daño con dirección) durante `sec` segundos.
    const lanes = (w: World, sec: number): number => {
      let n = 0;
      let before = 0;
      for (let i = 0; i < Math.round(sec * RUN.tickHz); i++) {
        w.spawnAcc = -1e9;
        tick(w, STILL, STEP);
        const now = w.tele.items.slice(0, w.tele.count).filter((t) => t.lx !== 0 || t.ly !== 0).length;
        if (now > before) n += now - before;
        before = now;
      }
      return n;
    };
    const charge = (aim: number, gap: number): number => aim + R.dash + gap;

    const w = quiet();
    const e = spawnEnemy(w, 'rey_rata', w.player.x + 600, w.player.y);
    e.timer = 0;
    run(w, STEP);
    // Primero se para a llamar a las ratas.
    expect(alive(w).filter((x) => x.type === R.summonType)).toHaveLength(R.summon);
    expect(e.burst).toBe(R.chain);
    const x0 = e.x;
    run(w, R.summonStop / 2);
    expect(e.x).toBe(x0);
    // Luego, `chain` embestidas casi seguidas, cada una con su pasillo sin daño.
    expect(lanes(w, R.summonStop / 2 + charge(R.aim, R.gap) * R.chain)).toBe(R.chain);
    expect(w.tele.items.slice(0, w.tele.count).every((t) => t.dmg === 0)).toBe(true);

    const w2 = quiet();
    const b = spawnEnemy(w2, 'rey_rata', w2.player.x + 600, w2.player.y);
    b.hp = b.maxHp * 0.4;
    b.timer = 0;
    run(w2, STEP * 2);
    expect(b.phase).toBe(2);
    expect(b.burst).toBe(R.chainP2);
    expect(lanes(w2, R.summonStop + charge(R.aimP2, R.gapP2) * R.chainP2)).toBe(R.chainP2);
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

describe('radiación', () => {
  it('los enemigos irradiados irradian al acercarse, sin tocarte', () => {
    const w = quiet();
    const e = spawnEnemy(w, 'torreta', w.player.x + IRRADIATED.auraR * 0.5, w.player.y, false);
    e.irr = true;
    run(w, 1);
    expect(w.player.rad).toBeCloseTo(IRRADIATED.auraRad, 0);
    e.irr = false;
    const before = w.player.rad;
    run(w, 1);
    expect(w.player.rad).toBeLessThanOrEqual(before);
  });

  it('al 100 % de RAD se muere, salvo inmortal', () => {
    const w = quiet();
    w.player.rad = RAD.max - 0.5;
    run(w, STEP);
    expect(w.player.deadAt).toBeNull();
    w.player.god = false;
    w.player.rad = RAD.max - 0.01;
    w.player.radIdle = 0;
    addRad(w, 1);
    run(w, STEP);
    expect(w.player.deadAt).not.toBeNull();
  });
});
