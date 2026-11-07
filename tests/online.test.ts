import { describe, expect, it } from 'vitest';
import { CHAR_IDS, LIMITS, checkNickname, checkRun } from '../supabase/functions/_shared/runCheck';
import { ACT_IDS, CAMPAIGN } from '../src/config/acts';
import { BOSS_IDS, ENEMY_STATS } from '../src/config/enemies';
import { RUN } from '../src/config/run';
import { STAT_SURVIVOR_IDS } from '../src/config/survivors';
import { ONLINE_ENABLED, takeAuthReturn, toSubmission } from '../src/online/online';
import { createWorld, results } from '../src/engine/world';
import { HIT_RAW, hitEnemy } from '../src/engine/systems/combat';
import { spawnBoss } from '../src/engine/systems/spawning';

const ok = {
  charId: 'dot',
  timeSec: 900,
  kills: 4000,
  bossDmg: 30000,
  dmgTotal: 900000,
  bosses: 3,
  level: 60,
  won: true,
  seed: 123,
};

describe('antitrampas del ranking', () => {
  it('acepta una victoria real', () => {
    expect(checkRun(ok)).toEqual([]);
  });

  it('rechaza valores imposibles', () => {
    expect(checkRun({ ...ok, timeSec: 99999 })).toContain('time');
    expect(checkRun({ ...ok, kills: 999999 })).toContain('kills');
    expect(checkRun({ ...ok, bossDmg: 30001 })).toContain('bossDmg');
    expect(checkRun({ ...ok, bosses: 4 })).toContain('bosses');
    expect(checkRun({ ...ok, timeSec: 60 })).toContain('won');
    expect(checkRun({ ...ok, bossDmg: 0 })).toContain('bossDmg-zero');
    expect(checkRun({ ...ok, charId: 'hacker' })).toContain('char');
    expect(checkRun({ ...ok, dmgTotal: 900 * LIMITS.maxDmgPerSec + 1 })).toContain('dmgTotal');
    expect(checkRun({ ...ok, dmgTotal: 100 })).toContain('dmgTotal-boss');
    expect(checkRun({ ...ok, kills: 1.5 })).toContain('int:kills');
    expect(checkRun({ ...ok, kills: -1 })).toContain('int:kills');
    expect(checkRun(null)).toEqual(['not-object']);
  });

  it('los límites cuadran con la config del juego', () => {
    const bossHp = Object.values(ENEMY_STATS)
      .filter((s) => 'boss' in s && s.boss)
      .reduce((a, s) => a + s.hp, 0);
    expect(LIMITS.maxBossDmg).toBe(bossHp);
    expect(LIMITS.bosses).toBe(BOSS_IDS.length);
    // Cota antitrampas: ganar antes de este segundo es imposible (el Coloso sale, como pronto, a 3 × `bossAt`).
    expect(LIMITS.minWinSec).toBeGreaterThan(0);
    expect(LIMITS.minWinSec).toBeLessThanOrEqual(ACT_IDS.length * CAMPAIGN.bossAt);
    expect(LIMITS.maxTimeSec).toBeGreaterThan(RUN.duration);
    expect([...CHAR_IDS].sort()).toEqual([...STAT_SURVIVOR_IDS].sort());
  });

  it('una run recién creada del juego pasa la validación', () => {
    const r = results(createWorld('mae', 77, {}));
    expect(checkRun(toSubmission(r))).toEqual([]);
  });
});

describe('daño a jefes', () => {
  it('cuenta el daño a jefes sin el exceso del golpe final', () => {
    const w = createWorld('dot', 3, { startWeapon: null });
    spawnBoss(w, 'rey_rata');
    const boss = w.enemies.items.find((e) => e.boss)!;
    hitEnemy(w, boss, 1000, 'llave', HIT_RAW);
    expect(w.bossDmg).toBe(1000);
    hitEnemy(w, boss, 1e9, 'llave', HIT_RAW);
    expect(w.bossDmg).toBe(ENEMY_STATS.rey_rata.hp);
    expect(results(w).bossDmg).toBe(ENEMY_STATS.rey_rata.hp);
  });
});

describe('apodos', () => {
  it('acepta apodos normales y rechaza los malos', () => {
    expect(checkNickname('Dot_93')).toBeNull();
    expect(checkNickname('Peña Brava')).toBeNull();
    expect(checkNickname('ab')).toBe('format');
    expect(checkNickname('a'.repeat(17))).toBe('format');
    expect(checkNickname('<script>')).toBe('format');
    expect(checkNickname('Ad-Min')).toBe('blocked');
    expect(checkNickname(42)).toBe('type');
  });
});

describe('modo sin conexión', () => {
  it('sin variables de entorno la capa online está apagada', () => {
    expect(ONLINE_ENABLED).toBe(false);
  });
});

describe('vuelta del login de Google', () => {
  const at = (search: string, hash = ''): { ret: ReturnType<typeof takeAuthReturn>; cleaned: boolean } => {
    let cleaned = false;
    Object.assign(globalThis, {
      window: {
        location: { search, hash, pathname: '/' },
        history: { replaceState: () => (cleaned = true) },
      },
    });
    const ret = takeAuthReturn();
    return { ret, cleaned };
  };

  it('reconoce la cuenta de Google ya vinculada a otro jugador y limpia la URL', () => {
    const q = '?error=server_error&error_code=identity_already_exists';
    expect(at(q, '#' + q.slice(1))).toEqual({ ret: 'identity-taken', cleaned: true });
  });

  it('cualquier otro error es genérico y sin error no toca la URL', () => {
    expect(at('', '#error=access_denied').ret).toBe('error');
    expect(at('', '#access_token=abc&refresh_token=def')).toEqual({ ret: null, cleaned: false });
  });
});
