// Furia configurable por enemigo (CAMBIOS §1): condiciones, duración, enfriamiento, velocidad y sermón.
import { afterEach, describe, expect, it } from 'vitest';
import { AI, ENEMY_STATS, RAGE, type RageProfile } from '../src/config/enemies';
import { RUN } from '../src/config/run';
import { applyTuning, resetTuning } from '../src/config/tuning';
import {
  RAGE_END,
  RAGE_NONE,
  RAGE_START,
  rageAllyNear,
  rageForce,
  rageOf,
  rageSpeed,
  rageStep,
  rageTrigger,
  type RageState,
} from '../src/engine/rage';
import { killEnemy } from '../src/engine/systems/combat';
import { spawnEnemy } from '../src/engine/systems/enemies';
import { createWorld, tick } from '../src/engine/world';
import type { World } from '../src/engine/types';

const STEP = 1 / RUN.tickHz;
afterEach(resetTuning);

function quietWorld(): World {
  // Sin oleadas: solo lo que pone el test.
  applyTuning({ spawn: { rateMult: 0 } });
  const w = createWorld('dot', 3, { hazards: false, startWeapon: null });
  w.player.god = true;
  w.level = RAGE.minLevel;
  return w;
}

const run = (w: World, s: number): void => {
  for (let i = 0; i < Math.round(s * RUN.tickHz); i++) tick(w, { moveX: 0, moveY: 0 }, STEP);
};

// ---------- reglas puras ----------

const DEF: RageProfile = {
  minLevel: 2,
  chaseAfter: 10,
  hpBelow: 0,
  allyDeathR: 0,
  speed: 1.2,
  dmg: 2,
  hp: 1.5,
  dur: 4,
  cd: 6,
};
const fresh = (): RageState => ({ hp: 1, maxHp: 1, rage: false, rageT: 0, rageCd: 0, chase: 0, rageN: 0 });

/** Avanza `sec` s y devuelve el primer resultado distinto de RAGE_NONE (y cuándo). */
function until(s: RageState, sec: number, ovr = undefined as Parameters<typeof rageStep>[3], hpFrac = 1) {
  s.hp = hpFrac;
  const dt = 0.1;
  for (let t = dt; t <= sec + 1e-9; t += dt) {
    const r = rageStep(s, dt, DEF, ovr, 5);
    if (r !== RAGE_NONE) return { r, t };
  }
  return { r: RAGE_NONE, t: sec };
}

describe('reglas de furia', () => {
  it('chaseAfter: se enfurece tras X s persiguiendo; 0 la desactiva', () => {
    const s = fresh();
    const a = until(s, 20);
    expect(a.r).toBe(RAGE_START);
    expect(a.t).toBeCloseTo(DEF.chaseAfter, 0);
    expect(s.rage).toBe(true);
    const off = fresh();
    expect(until(off, 60, { chaseAfter: 0 }).r).toBe(RAGE_NONE);
  });

  it('hpBelow: se enfurece al bajar de esa fracción de vida; 0 la desactiva', () => {
    const s = fresh();
    expect(until(s, 1, { hpBelow: 0.5 }, 0.6).r).toBe(RAGE_NONE);
    expect(until(s, 1, { hpBelow: 0.5 }, 0.4).r).toBe(RAGE_START);
    const off = fresh();
    expect(until(off, 1, { chaseAfter: 0, hpBelow: 0 }, 0.01).r).toBe(RAGE_NONE);
  });

  it('allyDeathR: solo salta con un aliado muerto dentro del radio; 0 la desactiva', () => {
    expect(rageAllyNear(DEF, { allyDeathR: 100 }, 99 * 99)).toBe(true);
    expect(rageAllyNear(DEF, { allyDeathR: 100 }, 101 * 101)).toBe(false);
    expect(rageAllyNear(DEF, undefined, 1)).toBe(false);
    const s = fresh();
    expect(rageTrigger(s, DEF, { allyDeathR: 100 }, 5)).toBe(RAGE_START);
    expect(s.rage).toBe(true);
  });

  it('dura `dur` s y luego respeta `cd` antes de volver a enfurecerse', () => {
    const s = fresh();
    s.chase = DEF.chaseAfter;
    expect(rageStep(s, 0.1, DEF, undefined, 5)).toBe(RAGE_START);
    const end = until(s, 10);
    expect(end.r).toBe(RAGE_END);
    expect(end.t).toBeCloseTo(DEF.dur, 0);
    expect(s.rage).toBe(false);
    expect(s.rageCd).toBe(DEF.cd);
    // En enfriamiento no vale ni un disparador externo ni una condición cumplida.
    expect(rageTrigger(s, DEF, { allyDeathR: 100 }, 5)).toBe(RAGE_NONE);
    s.chase = 99;
    const again = until(s, 20, { hpBelow: 0.9 }, 0.1);
    expect(again.r).toBe(RAGE_START);
    expect(again.t).toBeGreaterThanOrEqual(DEF.cd - 0.2);
    expect(s.rageN).toBe(2);
  });

  it('`enabled: false` y el nivel mínimo la impiden', () => {
    expect(until(fresh(), 60, { enabled: false }).r).toBe(RAGE_NONE);
    const s = fresh();
    s.chase = 99;
    expect(rageStep(s, 0.1, DEF, undefined, DEF.minLevel - 1)).toBe(RAGE_NONE);
    expect(rageForce(s, DEF, undefined, DEF.minLevel - 1)).toBe(RAGE_NONE);
    expect(rageForce(s, DEF, { enabled: false }, 5)).toBe(RAGE_NONE);
  });

  it('forzada (sermón) ignora el enfriamiento', () => {
    const s = fresh();
    s.rageCd = 50;
    expect(rageTrigger(s, DEF, undefined, 5)).toBe(RAGE_NONE);
    expect(rageForce(s, DEF, undefined, 5)).toBe(RAGE_START);
    expect(s.rageT).toBe(DEF.dur);
  });

  it('velocidad: max(la suya, la del jugador × speed) solo mientras dura', () => {
    const s = fresh();
    expect(rageSpeed(s, 100, 200, DEF, undefined)).toBe(100);
    s.rage = true;
    expect(rageSpeed(s, 100, 200, DEF, undefined)).toBeCloseTo(240);
    expect(rageSpeed(s, 300, 200, DEF, undefined)).toBe(300);
    expect(rageSpeed(s, 100, 200, DEF, { speed: 2 })).toBeCloseTo(400);
    expect(rageOf(DEF, { dmg: 5 }, 'dmg')).toBe(5);
    expect(rageOf(DEF, { dmg: 5 }, 'hp')).toBe(DEF.hp);
  });
});

// ---------- en el motor ----------

describe('furia en el motor', () => {
  it('perfil por defecto: se enfurece a los chaseAfter s, dura dur, respeta cd y cuenta en rs.rages', () => {
    const w = quietWorld();
    const e = spawnEnemy(w, 'dron', w.player.x + 1500, w.player.y, false);
    const hp = e.hp;
    const dmg = e.dmg;
    run(w, RAGE.chaseAfter - 0.5);
    expect(e.rage).toBe(false);
    run(w, 1);
    expect(e.rage).toBe(true);
    expect(w.rs.rages).toBe(1);
    expect(e.hp).toBeCloseTo(hp * RAGE.hp);
    expect(e.dmg).toBeCloseTo(dmg * RAGE.dmg);
    run(w, RAGE.dur);
    expect(e.rage).toBe(false);
    expect(e.dmg).toBeCloseTo(dmg);
    // En enfriamiento (y sin cumplir otra vez la persecución) sigue tranquilo.
    run(w, RAGE.cd - 1);
    expect(e.rage).toBe(false);
    // Vuelve a enfurecerse, pero la vida extra solo se aplica la primera vez.
    const hpNow = e.hp;
    run(w, 1);
    expect(e.rage).toBe(true);
    expect(w.rs.rages).toBe(2);
    expect(e.hp).toBeCloseTo(hpNow);
  });

  it('enfurecido con el perfil por defecto corre más que el jugador', () => {
    applyTuning({ rage: { chaseAfter: 0.5, dur: 2, cd: 50 } });
    const w = quietWorld();
    // Un dron (122 px/s) es más lento que el jugador: solo la furia le permite alcanzarlo.
    const e = spawnEnemy(w, 'dron', w.player.x + 1500, w.player.y, false);
    expect(RAGE.speed).toBeGreaterThan(1);
    run(w, RAGE.chaseAfter + 0.1);
    expect(e.speed).toBeLessThan(w.st.speed);
    expect(e.rage).toBe(true);
    const x = e.x;
    run(w, 1);
    expect(x - e.x).toBeGreaterThan(w.st.speed);
    expect(x - e.x).toBeLessThan(w.st.speed * RAGE.speed * 1.02);
    // Calmado, vuelve a su velocidad.
    run(w, RAGE.dur);
    expect(e.rage).toBe(false);
    const x2 = e.x;
    run(w, 1);
    expect(x2 - e.x).toBeCloseTo(ENEMY_STATS.dron.speed, 0);
  });

  it('hpBelow (saqueador): se enfurece al bajar de la mitad de vida y no antes', () => {
    applyTuning({ rage: { chaseAfter: 0 } });
    const w = quietWorld();
    const e = spawnEnemy(w, 'saqueador', w.player.x + 1000, w.player.y, false);
    expect(ENEMY_STATS.saqueador.rage?.hpBelow).toBe(0.5);
    e.hp = e.maxHp * 0.6;
    run(w, 1);
    expect(e.rage).toBe(false);
    e.hp = e.maxHp * 0.4;
    run(w, 0.2);
    expect(e.rage).toBe(true);
  });

  it('allyDeathR (reptador): muerto un aliado a menos de 160 px se enfurece; lejos o sin esa regla, no', () => {
    applyTuning({ rage: { chaseAfter: 0 } });
    const w = quietWorld();
    const { x, y } = w.player;
    const victim = spawnEnemy(w, 'reptador', x + 1000, y, false);
    const near = spawnEnemy(w, 'reptador', x + 1000 + 100, y, false);
    const far = spawnEnemy(w, 'reptador', x + 1000 + 400, y, false);
    const deaf = spawnEnemy(w, 'dron', x + 1000 + 50, y, false);
    expect(ENEMY_STATS.reptador.rage?.allyDeathR).toBe(160);
    run(w, 0.5);
    expect([near.rage, far.rage, deaf.rage]).toEqual([false, false, false]);
    killEnemy(w, victim, 'llave');
    run(w, STEP * 2);
    expect(near.rage).toBe(true);
    expect(far.rage).toBe(false);
    expect(deaf.rage).toBe(false);
    expect(w.rs.rages).toBe(1);
  });

  it('sin furia: tirador, torreta, interceptor, predicador… nunca se enfurecen', () => {
    applyTuning({ rage: { chaseAfter: 0.1 } });
    const w = quietWorld();
    const ids = ['tirador', 'torreta', 'interceptor', 'predicador', 'babosa', 'blindado'] as const;
    const es = ids.map((id) => spawnEnemy(w, id, w.player.x + 1000, w.player.y, false));
    run(w, 3);
    for (const e of es) expect(e.rage).toBe(false);
    expect(w.rs.rages).toBe(0);
  });

  it('el sermón del predicador la fuerza aunque esté en enfriamiento, pero no a quien no puede', () => {
    const w = quietWorld();
    const { x, y } = w.player;
    const pre = spawnEnemy(w, 'predicador', x + 300, y, false);
    const a = spawnEnemy(w, 'dron', x + 320, y, false);
    const b = spawnEnemy(w, 'dron', x + 340, y + 20, false);
    const nope = spawnEnemy(w, 'blindado', x + 330, y - 20, false);
    const far = spawnEnemy(w, 'dron', x + 300 + AI.predicador.r * 3, y, false);
    a.rageCd = 99;
    pre.timer = 0.01;
    run(w, 0.2);
    expect(a.rage).toBe(true);
    expect(b.rage).toBe(true);
    expect(nope.rage).toBe(false);
    expect(far.rage).toBe(false);
    expect(pre.rage).toBe(false);
    expect(w.rs.rages).toBe(2);
  });

  it('sin furia (ni sermón) antes del nivel mínimo', () => {
    const w = quietWorld();
    w.level = RAGE.minLevel - 1;
    const { x, y } = w.player;
    const pre = spawnEnemy(w, 'predicador', x + 300, y, false);
    const a = spawnEnemy(w, 'dron', x + 320, y, false);
    pre.timer = 0.01;
    run(w, RAGE.chaseAfter + 1);
    expect(a.rage).toBe(false);
  });
});
