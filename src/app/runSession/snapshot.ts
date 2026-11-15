// Foto del estado para el HUD (HudSnapshot), 10 veces por segundo.
import { BOSS_PHASES, ELITES, type BossKind, type EliteId, type StatEnemyId } from '../../config/enemies';
import type { ConsumableId, ItemId } from '../../config/items';
import { radTier } from '../../config/radiation';
import { PLAYER, streakMult } from '../../config/run';
import type { HordeKind } from '../../config/waves';
import type { DailyMod, ObjectiveKind } from '../../config/modes';
import type { WeaponId } from '../../config/weapons';
import { type ActId } from '../../config/acts';
import { actTime } from '../../engine/systems/campaign';
import type { Banner, World } from '../../engine/types';
import { isOnScreen, isoX, isoY } from '../../engine/view';
import { currentDps } from '../../engine/world';
import { weaponSlots, type StatSurvivorId } from '../../config/survivors';

export interface HudSnapshot {
  charId: StatSurvivorId;
  hp: number;
  maxHp: number;
  rad: number;
  radColor: string;
  xp: number;
  xpNext: number;
  level: number;
  time: number;
  /** Acto en curso y segundos que lleva. */
  act: ActId;
  actTime: number;
  kills: number;
  dps: number;
  weapons: { id: WeaponId; lvl: number }[];
  /** Huecos de arma: los del personaje más los ganados con los minijefes. */
  slots: number;
  cons: Record<ConsumableId, number>;
  items: ItemId[];
  rerolls: number;
  /** Jefe vivo: vida, fase y fracciones donde cambia de fase (marcas de la barra). */
  boss: { id: StatEnemyId; frac: number; phase: number; marks: readonly number[] } | null;
  /** Último élite golpeado, mientras dura su barra. */
  elite: { id: StatEnemyId; prefix: EliteId; frac: number } | null;
  /** Horda avisada: dirección de pantalla (unitaria) y fracción de la cuenta atrás que queda. */
  horde: { kind: HordeKind; sx: number; sy: number; left: number } | null;
  streak: number;
  streakMult: number;
  /** Objetivo del mapa: progreso, tiempo que queda y dirección de pantalla si está fuera de la vista. */
  objective: {
    kind: ObjectiveKind;
    progress: number;
    goal: number;
    left: number;
    dir: { sx: number; sy: number } | null;
  } | null;
  /** Minutos jugados en el modo infinito, o null. */
  endless: number | null;
  dailyMod: DailyMod | null;
  banners: Banner[];
  rain: boolean;
  storm: boolean;
}

function objectiveSnap(w: World): HudSnapshot['objective'] {
  const o = w.objective;
  if (!o) return null;
  let dir: { sx: number; sy: number } | null = null;
  if (!isOnScreen(w, o.x, o.y, -o.r * 0.5)) {
    const sx = isoX(o.x - w.player.x, o.y - w.player.y);
    const sy = isoY(o.x - w.player.x, o.y - w.player.y);
    const l = Math.hypot(sx, sy) || 1;
    dir = { sx: sx / l, sy: sy / l };
  }
  return { kind: o.kind, progress: o.progress, goal: o.goal, left: o.left, dir };
}

export function snapshot(w: World): HudSnapshot {
  let boss: HudSnapshot['boss'] = null;
  let elite: HudSnapshot['elite'] = null;
  const showElite = w.time - w.eliteFocusAt < ELITES.barTime;
  if (w.bossAlive > 0 || showElite) {
    for (let i = 0; i < w.enemies.count; i++) {
      const e = w.enemies.items[i]!;
      if (e.dead) continue;
      if (e.boss)
        boss = {
          id: e.type,
          frac: Math.max(0, e.hp / e.maxHp),
          phase: e.phase,
          marks: BOSS_PHASES[e.type as BossKind] ?? [],
        };
      else if (showElite && e.elite && e.id === w.eliteFocus)
        elite = { id: e.type, prefix: e.elite, frac: Math.max(0, e.hp / e.maxHp) };
    }
  }
  let horde: HudSnapshot['horde'] = null;
  if (w.horde) {
    const sx = isoX(w.horde.ax, w.horde.ay);
    const sy = isoY(w.horde.ax, w.horde.ay);
    const l = Math.hypot(sx, sy) || 1;
    horde = { kind: w.horde.kind, sx: sx / l, sy: sy / l, left: w.horde.t };
  }
  return {
    charId: w.charId,
    hp: Math.max(0, w.player.hp),
    maxHp: w.player.maxHp,
    rad: w.player.rad,
    radColor: radTier(w.player.rad).color,
    xp: w.xp,
    xpNext: w.xpNext,
    level: w.level,
    time: w.time,
    act: w.act,
    actTime: actTime(w),
    kills: w.kills,
    dps: currentDps(w),
    weapons: w.weapons.map((x) => ({ id: x.id, lvl: x.lvl })),
    slots: weaponSlots(w.charId, PLAYER.weaponSlots),
    cons: { ...w.cons },
    items: [...w.items],
    rerolls: w.rerolls,
    boss,
    elite,
    horde,
    objective: objectiveSnap(w),
    endless: w.endless ? (w.time - w.endlessAt) / 60 : null,
    dailyMod: w.dailyMod,
    streak: w.streak,
    streakMult: streakMult(w.streak),
    banners: w.banners.slice(),
    rain: w.rain > 0,
    storm: w.storm,
  };
}
