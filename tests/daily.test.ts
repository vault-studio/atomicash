// Reto diario: semilla del día y modificador.
import { describe, expect, it } from 'vitest';
import { checkRun, dailySeed } from '../supabase/functions/_shared/runCheck';
import { DAILY, DAILY_MODS } from '../src/config/modes';
import { applyRun } from '../src/meta/actions';
import { dailyChallenge, dailyOptions } from '../src/meta/daily';
import { defaultSave, normalize } from '../src/meta/save';
import { createWorld, results } from '../src/engine/world';

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
