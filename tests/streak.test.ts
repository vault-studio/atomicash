// Racha de bajas y su multiplicador.
import { describe, expect, it } from 'vitest';
import { ENEMY_STATS } from '../src/config/enemies';
import { STREAK, XP, streakMult } from '../src/config/run';
import { hurtPlayer, killEnemy } from '../src/engine/systems/combat';
import { spawnEnemy } from '../src/engine/systems/enemies';
import { type World } from '../src/engine/types';
import { createWorld } from '../src/engine/world';

function quiet(seed = 1): World {
  const w = createWorld('dot', seed, { startWeapon: null, hazards: false });
  w.nextElite = Infinity;
  w.nextSpecial = Infinity;
  w.spawnAcc = -1e9;
  w.player.god = true;
  for (const k of ['rey_rata', 'dirigible', 'coloso']) w.bossSpawned[k] = true;
  return w;
}

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
