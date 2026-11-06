// Evento «Tú mismo, otra vez»: bomba única en una ventana de tiempo, copia hostil del personaje y cofre al matarla.
import { afterEach, describe, expect, it } from 'vitest';
import { AI, BOSS_IDS, ENEMY_STATS, MIRROR_ID, MOB_IDS, STAT_ENEMY_IDS } from '../src/config/enemies';
import { MIRROR } from '../src/config/modes';
import { RUN } from '../src/config/run';
import { applyTuning, resetTuning } from '../src/config/tuning';
import { WAVES } from '../src/config/waves';
import { killEnemy, spriteIdFor } from '../src/engine/systems/combat';
import {
  createMirror,
  mirrorAngle,
  mirrorBulletDmg,
  mirrorHp,
  mirrorShotCount,
  putBomb,
} from '../src/engine/systems/mirror';
import { createWeapon } from '../src/engine/systems/weapons';
import { HURT_SOURCES, hurtIndex } from '../src/engine/runStats';
import type { Enemy, InputState, World } from '../src/engine/types';
import { createWorld, tick } from '../src/engine/world';
import type { StatSurvivorId } from '../src/config/survivors';

afterEach(resetTuning);
const STEP = 1 / RUN.tickHz;
const STAND: InputState = { moveX: 0, moveY: 0 };

/** Mundo sin oleadas, eventos ni jefes: solo el evento de la bomba. */
function quiet(seed = 1, char: StatSurvivorId = 'dot'): World {
  applyTuning({ spawn: { rateMult: 0 } });
  const w = createWorld(char, seed, { hazards: false, startWeapon: null });
  w.nextEvent = w.nextElite = w.nextHorde = w.nextObjective = w.nextDownpour = Infinity;
  w.player.god = true;
  for (const k of BOSS_IDS) w.bossSpawned[k] = true; // los jefes (saltando el reloj) no son el asunto
  return w;
}
const run = (w: World, sec: number): void => {
  for (let i = 0; i < Math.round(sec * RUN.tickHz); i++) tick(w, STAND, STEP);
};
const copies = (w: World): Enemy[] => {
  const out: Enemy[] = [];
  for (let i = 0; i < w.enemies.count; i++) {
    const e = w.enemies.items[i] as Enemy;
    if (e.type === MIRROR_ID && !e.dead) out.push(e);
  }
  return out;
};
/** Pisa la bomba: la pone encima del jugador y avanza un tick. */
function trigger(w: World): Enemy {
  putBomb(w, w.player.x, w.player.y);
  tick(w, STAND, STEP);
  const c = copies(w);
  expect(c).toHaveLength(1);
  return c[0]!;
}

describe('bomba', () => {
  it('sale una sola vez, dentro de la ventana [from, to]', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const w = quiet(seed);
      const at = w.mirror.at;
      expect(at).toBeGreaterThanOrEqual(MIRROR.from);
      expect(at).toBeLessThanOrEqual(MIRROR.to);
      w.time = at - 1;
      run(w, 0.5);
      expect(w.mirror.phase).toBe(0);
      run(w, 1);
      expect(w.mirror.phase).toBe(1);
      // A la distancia prevista del jugador.
      const d = Math.hypot(w.mirror.x - w.player.x, w.mirror.y - w.player.y);
      expect(d).toBeGreaterThanOrEqual(MIRROR.distMin - 1e-6);
      expect(d).toBeLessThanOrEqual(MIRROR.distMax + 1e-6);
    }
  });

  it('no sale antes de tiempo ni se repite en toda la partida', () => {
    const w = quiet(7);
    let appeared = 0;
    let prev = w.mirror.phase;
    for (let i = 0; i < 400 * RUN.tickHz; i++) {
      tick(w, STAND, STEP);
      if (w.mirror.phase === 1 && prev !== 1) appeared++;
      if (w.time < MIRROR.from) expect(w.mirror.phase).toBe(0);
      prev = w.mirror.phase;
    }
    expect(appeared).toBe(1);
  });

  it('se retrasa mientras haya un jefe vivo o recién muerto', () => {
    const w = quiet(3);
    w.time = w.mirror.at + 5;
    w.bossAlive = 1;
    run(w, 0.1);
    expect(w.mirror.phase).toBe(0);
    expect(w.mirror.at).toBeGreaterThan(w.time + 10);
    // Muere el jefe: aún se espera `bossQuiet` s desde su muerte.
    w.bossAlive = 0;
    w.lastBossAt = w.mirror.at - 10;
    w.time = w.mirror.at + 0.01;
    run(w, 0.1);
    expect(w.mirror.phase).toBe(0);
    w.time = w.mirror.at + 0.01;
    run(w, 0.1);
    expect(w.mirror.phase).toBe(1);
  });

  it('es determinista con la misma semilla', () => {
    const a = createMirror(42);
    const b = createMirror(42);
    expect(a.at).toBe(b.at);
    expect(createMirror(43).at).not.toBe(a.at);
    const place = (): [number, number] => {
      const w = quiet(42);
      w.time = w.mirror.at;
      run(w, 0.1);
      return [w.mirror.x, w.mirror.y];
    };
    expect(place()).toEqual(place());
  });

  it('no consume w.rng: la secuencia de la partida es la misma con o sin evento', () => {
    const sim = (off: boolean): { next: number; kills: number; enemies: number; phase: number } => {
      resetTuning();
      if (off) applyTuning({ mirror: { from: 1e9, to: 1e9 } });
      const w = createWorld('dot', 9, { hazards: false });
      for (const k of BOSS_IDS) w.bossSpawned[k] = true;
      w.player.god = true;
      w.time = 170;
      // Las subidas de nivel abren una elección que pararía el reloj: se descartan.
      for (let i = 0; i < 140 * RUN.tickHz; i++) {
        w.choice = null;
        tick(w, STAND, STEP);
      }
      return { next: w.rng(), kills: w.kills, enemies: w.enemies.count, phase: w.mirror.phase };
    };
    const on = sim(false);
    const off = sim(true);
    expect(on.phase).toBe(1);
    expect(off.phase).toBe(0);
    expect(on.next).toBe(off.next);
    expect(on.kills).toBe(off.kills);
    expect(on.enemies).toBe(off.enemies);
  });

  it('lejos no explota; al tocarla explota, hace blastDmg y crea exactamente una copia', () => {
    const w = quiet(5);
    w.player.god = false;
    putBomb(w, w.player.x + MIRROR.r + 40, w.player.y);
    run(w, 0.2);
    expect(w.mirror.phase).toBe(1);
    expect(copies(w)).toHaveLength(0);
    const hp = w.player.hp;
    const bannersBefore = w.banners.length;
    putBomb(w, w.player.x + MIRROR.r - 2, w.player.y);
    tick(w, STAND, STEP);
    expect(w.mirror.phase).toBe(2);
    expect(copies(w)).toHaveLength(1);
    expect(w.banners.length).toBe(bannersBefore + 1);
    expect(w.banners[w.banners.length - 1]!.key).toBe('banner.mirror');
    const lost = hp - w.player.hp;
    expect(lost).toBeCloseTo(Math.max(1, MIRROR.blastDmg - w.st.armor) * (1 - w.st.red), 5);
    // Una vez explotada, no vuelve a salir ni a crear más copias.
    putBomb(w, w.player.x, w.player.y);
    w.mirror.phase = 2;
    run(w, 5);
    expect(copies(w)).toHaveLength(1);
    expect(w.garrisons).toHaveLength(1);
  });
});

describe('copia', () => {
  it('no sale en oleadas ni en listas de enemigos normales, y cuenta como fuente de daño', () => {
    for (const wave of WAVES) expect(Object.keys(wave.mix)).not.toContain(MIRROR_ID);
    expect(MOB_IDS).not.toContain(MIRROR_ID);
    expect(STAT_ENEMY_IDS).toContain(MIRROR_ID);
    expect(HURT_SOURCES).toContain(MIRROR_ID);
    expect(hurtIndex(MIRROR_ID)).toBeGreaterThanOrEqual(0);
    expect(ENEMY_STATS.copia.role).toBe('shooter');
  });

  it('vida y velocidad siguen las fórmulas y es más lenta que el jugador', () => {
    const w = quiet(5);
    w.level = 7;
    const e = trigger(w);
    expect(e.maxHp).toBe(AI.copia.hpBase + AI.copia.hpPerLevel * 7);
    expect(e.maxHp).toBe(mirrorHp(w));
    expect(e.speed).toBeCloseTo(AI.copia.speedMult * w.st.speed, 9);
    expect(e.speed).toBeLessThan(w.st.speed);
    // La velocidad sigue a la del jugador.
    w.tr.spd = 50;
    tick(w, STAND, STEP);
    expect(e.speed).toBeCloseTo(AI.copia.speedMult * w.st.speed, 9);
    expect(e.speed).toBeLessThan(w.st.speed);
  });

  it('se dibuja con el sprite del personaje y su cadáver también', () => {
    for (const char of ['dot', 'gus', 'benny'] as const) {
      const w = quiet(5, char);
      const e = trigger(w);
      expect(e.skin).toBe(char);
      expect(spriteIdFor(e)).toBe(char);
      killEnemy(w, e, 'llave');
      expect(w.corpses.items[w.corpses.count - 1]!.sprite).toBe(char);
    }
  });

  it('se acerca hasta hold y se mantiene a esa distancia', () => {
    const w = quiet(5);
    const e = trigger(w);
    e.x = e.prevX = w.player.x + 900;
    e.y = e.prevY = w.player.y;
    e.timer = 1e9;
    run(w, 60);
    const d = Math.hypot(e.x - w.player.x, e.y - w.player.y);
    expect(d).toBeLessThanOrEqual(AI.copia.hold + 2);
    expect(d).toBeGreaterThan(AI.copia.hold - 30);
  });

  it('nace encima del jugador y se aparta hasta su distancia de disparo', () => {
    const w = quiet(3);
    const e = trigger(w);
    e.x = e.prevX = w.player.x + 10;
    e.y = e.prevY = w.player.y;
    e.timer = 1e9;
    run(w, 3);
    expect(Math.hypot(e.x - w.player.x, e.y - w.player.y)).toBeGreaterThanOrEqual(AI.copia.retreat - 2);
  });

  it('dispara la ráfaga prevista (base más una por arma) con el daño por nivel', () => {
    for (const weapons of [0, 2]) {
      const w = quiet(5);
      for (let i = 0; i < weapons; i++) w.weapons.push(createWeapon('llave'));
      w.level = 4;
      const e = trigger(w);
      e.x = e.prevX = w.player.x + 500;
      e.y = e.prevY = w.player.y;
      w.ebullets.clear();
      e.timer = 0;
      tick(w, STAND, STEP);
      const n = AI.copia.shots + AI.copia.shotsPerWeapon * weapons;
      expect(mirrorShotCount(w)).toBe(n);
      expect(w.ebullets.count).toBe(n);
      for (let i = 0; i < n; i++)
        expect(w.ebullets.items[i]!.dmg).toBeCloseTo(AI.copia.dmg + AI.copia.dmgPerLevel * 4);
      expect(w.ebullets.items[0]!.dmg).toBe(mirrorBulletDmg(w));
      // El abanico está centrado en el jugador.
      let sum = 0;
      for (let i = 0; i < n; i++) sum += mirrorAngle(i, n);
      expect(sum).toBeCloseTo(0, 9);
      // No vuelve a disparar hasta pasado `every`.
      tick(w, STAND, STEP);
      expect(w.ebullets.count).toBe(n);
    }
  });

  it('no dispara fuera de alcance', () => {
    const w = quiet(5);
    const e = trigger(w);
    e.x = e.prevX = w.player.x + AI.copia.range + 200;
    e.y = e.prevY = w.player.y;
    w.ebullets.clear();
    e.timer = 0;
    tick(w, STAND, STEP);
    expect(w.ebullets.count).toBe(0);
  });

  it('es una guarnición de uno: no se recoloca y al morir suelta un cofre especial', () => {
    const w = quiet(5);
    const e = trigger(w);
    expect(e.gar).toBe(0);
    expect(w.garrisons[0]).toMatchObject({ x: w.mirror.x, y: w.mirror.y, left: 1 });
    // Lejos del jugador, la reubicación de rezagados no la toca.
    e.x = e.prevX = w.player.x + 5000;
    e.y = e.prevY = w.player.y;
    e.timer = 1e9;
    const x = e.x;
    tick(w, STAND, STEP);
    expect(e.x).toBeGreaterThan(x - 50);
    const before = w.pickups.items.slice(0, w.pickups.count).filter((k) => k.kind === 'cache').length;
    killEnemy(w, e, 'llave');
    const caches = w.pickups.items.slice(0, w.pickups.count).filter((k) => k.kind === 'cache').length;
    expect(caches).toBe(before + 1);
    const chest = w.pickups.items.slice(0, w.pickups.count).find((k) => k.kind === 'cache')!;
    expect(chest.x).toBe(e.x);
    expect(w.garrisons[0]!.left).toBe(0);
    // Tras retirarla, la bomba no vuelve a salir.
    run(w, 2);
    expect(copies(w)).toHaveLength(0);
    expect(w.mirror.phase).toBe(2);
    w.time = 1000;
    run(w, 1);
    expect(w.mirror.phase).toBe(2);
  });
});
