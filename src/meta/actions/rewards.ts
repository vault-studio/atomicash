// Recompensas al acabar una run (y registro del reto diario).
import { CONSUMABLE_IDS } from '../../config/items';
import { MISSIONS, SURVIVOR_LEVEL, type AchievementId } from '../../config/meta';
import type { RunResults } from '../../engine/world';
import { DAILY } from '../../config/modes';
import { type SaveData } from '../save';
import { addSurvivorXp } from './collection';
import { checkAchievements, refreshDaily } from './missions';

// ---------- recompensas de la run ----------

export interface RunReward {
  credits: number;
  /** Premio del primer reto diario del día (incluido en `credits`). */
  dailyBonus: number;
  xp: number;
  levelUps: number;
  achievements: AchievementId[];
}

/** Cierra una run: créditos, XP del superviviente, estadísticas, consumibles sobrantes, misiones y logros. */
export function applyRun(s: SaveData, r: RunResults, now: Date): RunReward {
  refreshDaily(s, now);
  s.profile.credits += r.credits;
  const dailyBonus = r.daily ? recordDaily(s, r) : 0;
  const st = s.profile.stats;
  st.runs++;
  st.kills += r.kills;
  st.bossesKilled += r.bosses;
  st.bestTimeSec = Math.max(st.bestTimeSec, Math.floor(r.time));
  if (r.won) st.wins++;
  // La Mochila se descuenta al cerrar la run (así abandonar o recargar no pierde nada). El reto diario no la usa.
  if (!r.daily)
    for (const c of CONSUMABLE_IDS)
      s.inventory.consumables[c] = Math.max(0, s.inventory.consumables[c] - r.consStart[c] + r.consLeft[c]);
  const xp = Math.round(
    r.time * SURVIVOR_LEVEL.perSec + r.kills * SURVIVOR_LEVEL.perKill + r.bosses * SURVIVOR_LEVEL.perBoss,
  );
  const o = s.survivors[r.charId];
  const levelUps = o ? addSurvivorXp(o, xp) : 0;
  const min = Math.floor(r.time / 60);
  for (const m of s.missions.daily) {
    const def = MISSIONS[m.id];
    switch (def.kind) {
      case 'kills':
        m.progress += r.kills;
        break;
      case 'surviveMin':
        m.progress = Math.max(m.progress, min);
        break;
      case 'surviveWith':
        if (m.char === r.charId) m.progress = Math.max(m.progress, min);
        break;
      case 'runs':
        m.progress++;
        break;
      case 'bosses':
        m.progress += r.bosses;
        break;
      case 'consumables':
        m.progress += r.consUsed;
        break;
    }
    m.progress = Math.min(m.progress, def.goal);
  }
  return { credits: r.credits + dailyBonus, dailyBonus, xp, levelUps, achievements: checkAchievements(s) };
}

/** Guarda la marca del reto diario (la mejor del día) y da el premio del primer intento. */
function recordDaily(s: SaveData, r: RunResults): number {
  const d = s.daily;
  if (d.day !== r.daily) {
    d.day = r.daily!;
    d.best = null;
    d.rewarded = false;
  }
  if (!d.best || r.dmg > d.best.dmg) d.best = { dmg: r.dmg, time: Math.floor(r.time), kills: r.kills };
  if (d.rewarded) return 0;
  d.rewarded = true;
  s.profile.credits += DAILY.reward;
  return DAILY.reward;
}
