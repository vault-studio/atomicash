// Validación antitrampas de una run enviada al ranking (05_TECH.md §8). TS puro y sin dependencias:
// lo usan la Edge Function `submit-run` (Deno) y el cliente/tests (Vite). Los límites salen de
// `src/config` y `tests/online.test.ts` comprueba que siguen cuadrando con la config del juego.

export const LIMITS = {
  /** RUN.duration (900) + margen de la Tormenta, que mata en pocos minutos. */
  maxTimeSec: 1500,
  /**
   * Lo antes que puede salir el jefe final: a su minuto (BOSSES.coloso.at) o, si llega antes a sus bajas, al ritmo
   * máximo de bajas (BOSSES.coloso.kills / maxKillsPerSec, redondeado arriba). Ganar antes es imposible.
   */
  minWinSec: 67,
  bosses: 3,
  /** Suma de la vida de los 3 jefes (rey_rata 3000 + dirigible 7000 + coloso 20000). */
  maxBossDmg: 30000,
  /** Bajas por segundo sostenidas: muy por encima de lo que permite el ritmo de aparición. */
  maxKillsPerSec: 15,
  killsSlack: 100,
  /**
   * Daño total por segundo de partida: muy por encima de lo que hace un personaje a tope (unos miles de DPS al
   * final, contando el daño que se pasa de la vida de cada enemigo).
   */
  maxDmgPerSec: 50000,
  maxLevel: 300,
  /** Modo infinito tras el Coloso (src/config/modes.ts): segundos extra como mucho y un jefe cada `bossEvery`. */
  maxEndlessSec: 7200,
  endlessBossEvery: 150,
  /** Vida extra de los jefes del infinito por vuelta de la rueda (ENDLESS.bossHpPerLoop). */
  endlessBossHpPerLoop: 0.5,
} as const;

/** Día UTC `AAAA-MM-DD` del reto diario. */
export const DAILY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Semilla del reto diario de un día (FNV-1a de `daily:<día>`): la misma para todos. */
export function dailySeed(day: string): number {
  let h = 0x811c9dc5;
  const s = 'daily:' + day;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h | 0;
}

export const CHAR_IDS = [
  'dot',
  'mae',
  'errante',
  'benny',
  'silas',
  'gus',
  'ilse',
  'kip',
  'rosalind',
] as const;

export interface RunSubmission {
  charId: string;
  timeSec: number;
  kills: number;
  bossDmg: number;
  /** Daño total de la partida (ranking «Daño total»). */
  dmgTotal: number;
  bosses: number;
  level: number;
  won: boolean;
  seed: number;
  /** Reto diario (día UTC) o null. */
  daily?: string | null;
  /** Segundos jugados en el modo infinito tras ganar (`timeSec` es lo que tardó en ganar). */
  endlessSec?: number;
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

/** Devuelve la lista de problemas (vacía = válida). Los números deben llegar ya redondeados. */
export function checkRun(r: unknown): string[] {
  if (typeof r !== 'object' || r === null) return ['not-object'];
  const x = r as Record<string, unknown>;
  const errs: string[] = [];
  if (typeof x.charId !== 'string' || !(CHAR_IDS as readonly string[]).includes(x.charId)) errs.push('char');
  for (const k of ['timeSec', 'kills', 'bossDmg', 'dmgTotal', 'bosses', 'level', 'seed'] as const)
    if (!isInt(x[k]) || (k !== 'seed' && (x[k] as number) < 0)) errs.push(`int:${k}`);
  if (typeof x.won !== 'boolean') errs.push('won');
  if (x.endlessSec !== undefined && (!isInt(x.endlessSec) || x.endlessSec < 0)) errs.push('int:endlessSec');
  if (x.daily !== undefined && x.daily !== null && (typeof x.daily !== 'string' || !DAILY_RE.test(x.daily)))
    errs.push('daily');
  if (errs.length) return errs;
  const s = x as unknown as RunSubmission;
  const extra = s.endlessSec ?? 0;
  const total = s.timeSec + extra;
  // Jefes del infinito: uno cada `endlessBossEvery` s, cada vuelta de tres con más vida.
  const extraBosses = Math.ceil(extra / LIMITS.endlessBossEvery);
  const loops = Math.ceil(extraBosses / LIMITS.bosses);
  const maxBossDmg = LIMITS.maxBossDmg * (1 + loops * (1 + loops * LIMITS.endlessBossHpPerLoop));
  if (s.timeSec > LIMITS.maxTimeSec) errs.push('time');
  if (extra > LIMITS.maxEndlessSec || (extra > 0 && !s.won)) errs.push('endless');
  if (s.bosses > LIMITS.bosses + extraBosses) errs.push('bosses');
  if (s.bossDmg > maxBossDmg) errs.push('bossDmg');
  if (s.bossDmg === 0 && s.bosses > 0) errs.push('bossDmg-zero');
  if (s.kills > total * LIMITS.maxKillsPerSec + LIMITS.killsSlack) errs.push('kills');
  if (s.level > LIMITS.maxLevel) errs.push('level');
  if (s.dmgTotal > Math.max(1, total) * LIMITS.maxDmgPerSec) errs.push('dmgTotal');
  if (s.daily && s.seed !== dailySeed(s.daily)) errs.push('daily-seed');
  if (s.dmgTotal < s.bossDmg) errs.push('dmgTotal-boss');
  if (s.won && (s.bosses < LIMITS.bosses || s.timeSec < LIMITS.minWinSec)) errs.push('won');
  return errs;
}

/** Apodo: 3–16 letras, números, espacio, guion o guion bajo; sin palabras vetadas. */
export const NICK_RE = /^[\p{L}\p{N}_\- ]{3,16}$/u;
// DECISIÓN: lista corta y ampliable; la moderación real es por reportes (3 reportes ocultan la entrada).
const BLOCKED = ['admin', 'moderador', 'nazi', 'puta', 'fuck', 'shit', 'nigg'];

export function checkNickname(n: unknown): string | null {
  if (typeof n !== 'string') return 'type';
  const t = n.trim();
  if (!NICK_RE.test(t)) return 'format';
  const low = t.toLowerCase().replace(/[\s_-]/g, '');
  if (BLOCKED.some((b) => low.includes(b))) return 'blocked';
  return null;
}
