// Resultados al acabar la run.
import type { ConsumableId, ItemId } from '../../config/items';
import { CREDITS } from '../../config/run';
import { type StatSurvivorId } from '../../config/survivors';
import type { DailyMod } from '../../config/modes';
import { DAMAGE_SOURCES, type WeaponId } from '../../config/weapons';
import type { World } from '../types';

export interface RunResults {
  charId: StatSurvivorId;
  seed: number;
  won: boolean;
  time: number;
  kills: number;
  level: number;
  bosses: number;
  dmg: number;
  bossDmg: number;
  rad: number;
  /** Incluye los cupones recogidos en la partida (`coupons`). */
  credits: number;
  coupons: number;
  consUsed: number;
  /** Consumibles que sobraron (vuelven a la Mochila). */
  consLeft: Record<ConsumableId, number>;
  consStart: Record<ConsumableId, number>;
  /** Daño por fuente, de mayor a menor (solo las que hicieron daño). */
  dmgBy: { src: string; dmg: number }[];
  weapons: { id: WeaponId; lvl: number }[];
  items: ItemId[];
  maxHit: number;
  peakDps: number;
  peakKills5: number;
  bestStreak: number;
  objectives: number;
  /** Siguió en el modo infinito tras el Coloso; `winTime` es cuándo cayó. */
  endless: boolean;
  winTime: number;
  daily: string | null;
  dailyMod: DailyMod | null;
  /** Daño y bajas por tramo de `SUMMARY.bucket` s (gráfica del ticket). */
  timeDmg: number[];
  timeKills: number[];
}

export function results(w: World): RunResults {
  const min = w.time / 60;
  const dmgBy = DAMAGE_SOURCES.map((src, i) => ({ src: src as string, dmg: Math.round(w.dmgBy[i]!) }))
    .filter((x) => x.dmg > 0)
    .sort((a, b) => b.dmg - a.dmg);
  return {
    charId: w.charId,
    seed: w.seed,
    won: w.won,
    time: w.time,
    kills: w.kills,
    level: w.level,
    bosses: w.bosses,
    dmg: Math.round(w.dmgTotal),
    bossDmg: Math.round(w.bossDmg),
    rad: Math.round(w.player.radPeak),
    credits:
      Math.floor(min * CREDITS.perMin + w.kills / CREDITS.perKills + w.bosses * CREDITS.perBoss) + w.coupons,
    coupons: w.coupons,
    consUsed: w.consUsed,
    consLeft: { ...w.cons },
    consStart: { ...w.consStart },
    dmgBy,
    weapons: w.weapons.map((x) => ({ id: x.id, lvl: x.lvl })),
    items: [...w.items],
    maxHit: Math.round(w.maxHit),
    peakDps: Math.round(w.peakDps),
    peakKills5: w.peakKills5,
    bestStreak: w.bestStreak,
    objectives: w.objectivesDone,
    endless: w.endless,
    winTime: w.winTime,
    daily: w.daily,
    dailyMod: w.dailyMod,
    timeDmg: w.timeDmg.map(Math.round),
    timeKills: [...w.timeKills],
  };
}
