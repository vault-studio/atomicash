// Misiones diarias y logros.
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_IDS,
  DAILY_COUNT,
  MISSIONS,
  MISSION_IDS,
  type AchievementId,
} from '../../config/meta';
import { ROSTER } from '../../config/survivors';
import { createRng } from '../../engine/rng';
import { type SaveData } from '../save';
import { dayKey, hashSeed, owned, pickN } from './util';

// ---------- misiones y logros ----------

/** Genera las 3 diarias si ha cambiado el día local. */
export function refreshDaily(s: SaveData, now: Date): void {
  const day = dayKey(now);
  if (s.missions.day === day) return;
  const rng = createRng(hashSeed('missions:' + day));
  const chars = owned(s);
  s.missions.day = day;
  s.missions.daily = pickN(rng, MISSION_IDS, DAILY_COUNT).map((id) => ({
    id,
    progress: 0,
    claimed: false,
    char:
      MISSIONS[id].kind === 'surviveWith' ? (pickN(rng, chars.length ? chars : ROSTER, 1)[0] ?? null) : null,
  }));
}

export function claimMission(s: SaveData, i: number): boolean {
  const m = s.missions.daily[i];
  if (!m || m.claimed || m.progress < MISSIONS[m.id].goal) return false;
  m.claimed = true;
  s.profile.credits += MISSIONS[m.id].reward;
  return true;
}

export function achievementProgress(s: SaveData, id: AchievementId): number {
  const def = ACHIEVEMENTS[id];
  const st = s.profile.stats;
  const list = Object.values(s.survivors);
  switch (def.kind) {
    case 'totalKills':
      return st.kills;
    case 'win':
      return st.wins;
    case 'bossesTotal':
      return st.bossesKilled;
    case 'collection':
      return list.length;
    case 'survivorLevel':
      return list.reduce((m, o) => Math.max(m, o.level), 0);
    case 'irradiated':
      return list.filter((o) => o.irradiated).length;
  }
}

/** Desbloquea los logros cumplidos y entrega su premio (créditos y fichas del activo). */
export function checkAchievements(s: SaveData): AchievementId[] {
  const out: AchievementId[] = [];
  for (const id of ACHIEVEMENT_IDS) {
    if (s.missions.achievements[id]) continue;
    const def = ACHIEVEMENTS[id];
    if (achievementProgress(s, id) < def.goal) continue;
    s.missions.achievements[id] = true;
    s.profile.credits += def.credits;
    const act = s.profile.active ? s.survivors[s.profile.active] : undefined;
    if (act) act.shards += def.shards;
    out.push(id);
  }
  return out;
}
