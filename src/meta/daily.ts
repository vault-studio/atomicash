// Reto diario (dossier §14): el mismo para todos en el día UTC. Semilla, superviviente y modificador salen del día.
import { dailySeed } from '../../supabase/functions/_shared/runCheck';
import { DAILY, DAILY_MODS, type DailyMod } from '../config/modes';
import { PLAYER } from '../config/run';
import type { StatSurvivorId } from '../config/survivors';
import { createRng } from '../engine/rng';
import type { WorldOptions } from '../engine/world';

export interface DailyChallenge {
  day: string;
  seed: number;
  charId: StatSurvivorId;
  mod: DailyMod;
}

/** Día UTC `AAAA-MM-DD` (el mismo en todo el mundo, como el ranking). */
export function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function dailyChallenge(now: Date): DailyChallenge {
  const day = utcDay(now);
  const seed = dailySeed(day);
  const rng = createRng(seed ^ 0x2545f491);
  return {
    day,
    seed,
    charId: DAILY.roster[Math.floor(rng() * DAILY.roster.length)]!,
    mod: DAILY_MODS[Math.floor(rng() * DAILY_MODS.length)]!,
  };
}

/**
 * Opciones de la run del reto: sin Taller, estrellas, árbol ni implantes, con el arma y los consumibles de serie
 * (no gasta la Mochila).
 */
export function dailyOptions(c: DailyChallenge): WorldOptions {
  return { daily: { day: c.day, mod: c.mod }, consumables: { ...PLAYER.startConsumables } };
}
