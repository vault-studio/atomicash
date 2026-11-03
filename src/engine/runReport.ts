// Informe exportable de una partida (CAMBIOS §6.4): se genera al pedirlo (depurador o simulación), no en cada tick.
import { STAT_ENEMY_IDS } from '../config/enemies';
import { DAMAGE_SOURCES } from '../config/weapons';
import { HURT_SOURCES } from './runStats';
import type { World } from './types';

const r1 = (x: number): number => Math.round(x * 10) / 10;

export interface RunReport {
  charId: string;
  seed: number;
  /** Segundos jugados. */
  time: number;
  won: boolean;
  level: number;
  kills: number;
  /** Minuto de la muerte y tipo que dio el último golpe (null si sigue vivo). */
  deathMin: number | null;
  deathCause: string | null;
  build: string;
  hpLostPerMin: number[];
  damageTaken: { src: string; dmg: number; pct: number }[];
  damageDealt: { src: string; dmg: number; dps: number; pct: number }[];
  /** Tiempo para matar (s, del primer golpe a la muerte) y bajas por tipo. */
  ttk: { type: string; kills: number; ttk: number }[];
  killsPerMin: number[];
  xpPerMin: number[];
  /** Minuto en que se alcanza cada nivel (índice = nivel; −1 = no alcanzado). */
  levelMin: number[];
  alivePerMin: number[];
  surrounded: number;
  stuns: number;
  chargesHit: number;
  chargesDodged: number;
  shellsHit: number;
  shellsDodged: number;
  rages: number;
  picks: { min: number; kind: string; id: string }[];
}

export function buildReport(w: World): RunReport {
  const rs = w.rs;
  const taken = [...rs.dmgTaken].reduce((a, b) => a + b, 0) || 1;
  const dealt = [...w.dmgBy].reduce((a, b) => a + b, 0) || 1;
  const dead = w.player.deadAt !== null;
  return {
    charId: w.charId,
    seed: w.seed,
    time: r1(w.time),
    won: w.won,
    level: w.level,
    kills: w.kills,
    deathMin: dead ? r1(w.player.deadAt! / 60) : null,
    deathCause: dead && rs.lastSrc >= 0 ? HURT_SOURCES[rs.lastSrc]! : null,
    build: w.weapons.map((x) => `${x.id}:${x.lvl}`).join(','),
    hpLostPerMin: rs.hpLostMin.map(Math.round),
    damageTaken: HURT_SOURCES.map((src, i) => ({ src, dmg: Math.round(rs.dmgTaken[i]!), pct: 0 }))
      .filter((x) => x.dmg > 0)
      .map((x) => ({ ...x, pct: r1((x.dmg / taken) * 100) }))
      .sort((a, b) => b.dmg - a.dmg),
    damageDealt: DAMAGE_SOURCES.map((src, i) => {
      const dmg = w.dmgBy[i]!;
      const since = rs.weaponAt[src] ?? 0;
      return {
        src,
        dmg: Math.round(dmg),
        dps: r1(dmg / Math.max(1, w.time - since)),
        pct: r1((dmg / dealt) * 100),
      };
    })
      .filter((x) => x.dmg > 0)
      .sort((a, b) => b.dmg - a.dmg),
    ttk: STAT_ENEMY_IDS.map((type, i) => ({
      type,
      kills: rs.killsBy[i]!,
      ttk: rs.killsBy[i]! > 0 ? Math.round((rs.ttkSum[i]! / rs.killsBy[i]!) * 100) / 100 : 0,
    })).filter((x) => x.kills > 0),
    killsPerMin: [...rs.killsMin],
    xpPerMin: rs.xpMin.map(Math.round),
    levelMin: rs.levelAt.map((t) => (t < 0 ? -1 : r1(t / 60))),
    alivePerMin: rs.aliveSum.map((s, i) => Math.round(s / Math.max(1, rs.aliveSamples[i]!))),
    surrounded: rs.surrounded,
    stuns: rs.stuns,
    chargesHit: rs.chargesHit,
    chargesDodged: rs.chargesDodged,
    shellsHit: rs.shellsHit,
    shellsDodged: rs.shellsDodged,
    rages: (rs as { rages?: number }).rages ?? 0,
    picks: rs.picks.map((p) => ({ min: r1(p.t / 60), kind: p.kind, id: p.id })),
  };
}

const csvCell = (v: unknown): string => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Varias partidas en CSV: una fila por partida, con columnas por fuente, arma y tipo para comparar builds y versiones. */
export function reportsToCsv(
  reps: readonly RunReport[],
  extra: readonly Record<string, unknown>[] = [],
): string {
  const rows = reps.map((r, i) => {
    const row: Record<string, unknown> = {
      ...extra[i],
      char: r.charId,
      seed: r.seed,
      time: r.time,
      won: r.won,
      level: r.level,
      kills: r.kills,
      deathMin: r.deathMin ?? '',
      deathCause: r.deathCause ?? '',
      build: r.build,
      surrounded: r.surrounded,
      stuns: r.stuns,
      chargesHit: r.chargesHit,
      chargesDodged: r.chargesDodged,
      shellsHit: r.shellsHit,
      shellsDodged: r.shellsDodged,
      rages: r.rages,
    };
    for (const x of r.damageTaken) row[`taken.${x.src}`] = x.dmg;
    for (const x of r.damageDealt) row[`dealt.${x.src}`] = x.dmg;
    for (const x of r.ttk) row[`ttk.${x.type}`] = x.ttk;
    return row;
  });
  const cols: string[] = [];
  for (const row of rows) for (const k of Object.keys(row)) if (!cols.includes(k)) cols.push(k);
  return [cols.join(','), ...rows.map((row) => cols.map((c) => csvCell(row[c])).join(','))].join('\n') + '\n';
}
