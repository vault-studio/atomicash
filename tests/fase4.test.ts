// Dossier fase 4: barriles, objetivos, reto diario, modo infinito y la validación del ranking.
import { describe, expect, it } from 'vitest';
import { checkRun, dailySeed } from '../supabase/functions/_shared/runCheck';
import { DAILY, DAILY_MODS, ENDLESS, OBJECTIVES } from '../src/config/modes';
import { RUN } from '../src/config/run';
import { applyRun } from '../src/meta/actions';
import { dailyChallenge, dailyOptions } from '../src/meta/daily';
import { defaultSave, normalize } from '../src/meta/save';
import { hitEnemy, killEnemy } from '../src/engine/systems/combat';
import { spawnEnemy } from '../src/engine/systems/enemies';
import { explodeBarrel, startObjective } from '../src/engine/systems/modes';
import { applyChoice } from '../src/engine/systems/progression';
import type { InputState, World } from '../src/engine/types';
import { createWorld, results, tick } from '../src/engine/world';
import { toSubmission } from '../src/online/online';

const STEP = 1 / RUN.tickHz;
const STILL: InputState = { moveX: 0, moveY: 0 };

function quiet(opts = {}): World {
  const w = createWorld('dot', 1, { startWeapon: null, hazards: false, ...opts });
  w.nextSpecial = w.nextElite = w.nextObjective = Infinity;
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

describe('barriles explosivos', () => {
  it('revientan, dañan a los de alrededor y encadenan a los vecinos', () => {
    const w = quiet();
    const p = w.player;
    const e = spawnEnemy(w, 'necrofago', p.x + 300, p.y, false);
    for (const dx of [280, 360]) {
      const b = w.barrels.acquire();
      b.x = p.x + dx;
      b.y = p.y;
      b.r = 13;
      b.fuse = -1;
    }
    w.enemyGrid.build(w.enemies.items, w.enemies.count);
    explodeBarrel(w, 0);
    expect(e.hp).toBeLessThan(e.maxHp);
    expect(w.barrels.count).toBe(1);
    expect(w.barrels.items[0]!.fuse).toBeGreaterThan(0);
    run(w, 0.3);
    expect(w.barrels.count).toBe(0);
  });
});

describe('objetivos del mapa', () => {
  it('aguantar en la zona da un cofre especial y cupones', () => {
    const w = quiet();
    w.objectiveIdx = 0;
    startObjective(w);
    const o = w.objective!;
    expect(o.kind).toBe('hold');
    w.player.x = o.x;
    w.player.y = o.y;
    run(w, OBJECTIVES.hold.goal + 0.2);
    expect(w.objective).toBeNull();
    expect(w.objectivesDone).toBe(1);
    expect(w.coupons).toBe(OBJECTIVES.coupons);
    // El cofre sale en el centro de la zona, justo donde está el jugador: se abre al momento.
    expect(w.choice?.type).toBe('cache');
  });

  it('la purga cuenta las bajas con el jugador dentro de la zona, estén donde estén, y caduca si no llegas', () => {
    const w = quiet();
    w.objectiveIdx = 1;
    startObjective(w);
    const o = w.objective!;
    expect(o.kind).toBe('purge');
    // Jugador fuera: no cuenta aunque el enemigo esté en el centro de la zona.
    w.player.x = o.x + o.r * 3;
    w.player.y = o.y;
    killEnemy(w, spawnEnemy(w, 'dron', o.x, o.y), 'llave');
    expect(o.progress).toBe(0);
    // Jugador dentro: cuenta aunque el enemigo esté fuera.
    w.player.x = o.x;
    w.player.y = o.y;
    killEnemy(w, spawnEnemy(w, 'dron', o.x + o.r * 2, o.y), 'llave');
    expect(o.progress).toBe(1);
    w.player.x = o.x + o.r * 3;
    run(w, OBJECTIVES.purge.limit + 0.2);
    expect(w.objective).toBeNull();
    expect(w.objectivesDone).toBe(0);
  });
});

describe('modo infinito', () => {
  it('tras el Coloso se puede seguir: sin Tormenta, más duro, sin jefes y con un élite cada 15 s', () => {
    const w = quiet();
    const c = spawnEnemy(w, 'coloso', w.player.x + 400, w.player.y, false);
    hitEnemy(w, c, 1e9, 'llave', 4);
    expect(w.choice?.type).toBe('endless');
    applyChoice(w, 0);
    expect(w.endless).toBe(true);
    expect(w.over).toBe(false);
    w.time = RUN.stormStart + 5;
    w.nextElite = w.time;
    run(w, 1);
    expect(w.storm).toBe(false);
    expect(w.bossAlive).toBe(0);
    expect(w.nextElite).toBeCloseTo(w.time + ENDLESS.eliteEvery - 1, 0);
    w.endlessAt = w.time - 60 * 4;
    const e = spawnEnemy(w, 'dron', w.player.x + 500, w.player.y, false);
    expect(e.maxHp).toBeGreaterThan(8 * (1 + w.time / 250) * (1 + 3.9 * ENDLESS.hpPerMin));
    const r = results(w);
    expect(r.endless).toBe(true);
    const sub = toSubmission(r);
    expect(sub.timeSec).toBe(Math.floor(r.winTime));
    expect(sub.endlessSec).toBeGreaterThan(0);
  });
});

describe('reto diario', () => {
  it('es el mismo para todos en el día y cambia al siguiente', () => {
    const a = dailyChallenge(new Date('2026-10-29T03:00:00Z'));
    const b = dailyChallenge(new Date('2026-10-29T22:00:00Z'));
    expect(a).toEqual(b);
    expect(a.seed).toBe(dailySeed('2026-10-29'));
    expect(DAILY.roster).toContain(a.charId);
    expect(DAILY_MODS).toContain(a.mod);
    const days = new Set(
      Array.from({ length: 10 }, (_, i) => dailyChallenge(new Date(Date.UTC(2026, 10, i + 1))).seed),
    );
    expect(days.size).toBe(10);
  });

  it('guarda la mejor marca del día, paga el primer intento y no gasta la Mochila', () => {
    const s = normalize({ ...defaultSave(), profile: { ...defaultSave().profile, starterChosen: 'dot' } });
    const c = dailyChallenge(new Date('2026-10-29T12:00:00Z'));
    const w = createWorld(c.charId, c.seed, { ...dailyOptions(c), hazards: false });
    w.cons.grenade = 0;
    const r = results(w);
    expect(r.daily).toBe(c.day);
    const before = { ...s.inventory.consumables };
    const credits = s.profile.credits;
    expect(applyRun(s, r, new Date()).dailyBonus).toBe(DAILY.reward);
    expect(s.profile.credits).toBe(credits + r.credits + DAILY.reward);
    expect(s.inventory.consumables).toEqual(before);
    expect(s.daily.best).not.toBeNull();
    expect(applyRun(s, r, new Date()).dailyBonus).toBe(0);
  });

  it('el ranking rechaza un reto con otra semilla', () => {
    const base = {
      charId: 'dot',
      timeSec: 300,
      kills: 500,
      bossDmg: 3000,
      dmgTotal: 90000,
      bosses: 1,
      level: 20,
      won: false,
    };
    expect(checkRun({ ...base, seed: dailySeed('2026-10-29'), daily: '2026-10-29' })).toEqual([]);
    expect(checkRun({ ...base, seed: 1, daily: '2026-10-29' })).toContain('daily-seed');
    expect(checkRun({ ...base, seed: 1, daily: 'ayer' })).toContain('daily');
    expect(checkRun({ ...base, seed: 1, endlessSec: 60 })).toContain('endless');
  });
});
