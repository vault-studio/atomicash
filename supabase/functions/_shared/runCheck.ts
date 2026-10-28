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
  maxLevel: 300,
} as const;

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
  bosses: number;
  level: number;
  won: boolean;
  seed: number;
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

/** Devuelve la lista de problemas (vacía = válida). Los números deben llegar ya redondeados. */
export function checkRun(r: unknown): string[] {
  if (typeof r !== 'object' || r === null) return ['not-object'];
  const x = r as Record<string, unknown>;
  const errs: string[] = [];
  if (typeof x.charId !== 'string' || !(CHAR_IDS as readonly string[]).includes(x.charId)) errs.push('char');
  for (const k of ['timeSec', 'kills', 'bossDmg', 'bosses', 'level', 'seed'] as const)
    if (!isInt(x[k]) || (k !== 'seed' && (x[k] as number) < 0)) errs.push(`int:${k}`);
  if (typeof x.won !== 'boolean') errs.push('won');
  if (errs.length) return errs;
  const s = x as unknown as RunSubmission;
  if (s.timeSec > LIMITS.maxTimeSec) errs.push('time');
  if (s.bosses > LIMITS.bosses) errs.push('bosses');
  if (s.bossDmg > LIMITS.maxBossDmg) errs.push('bossDmg');
  if (s.bossDmg === 0 && s.bosses > 0) errs.push('bossDmg-zero');
  if (s.kills > s.timeSec * LIMITS.maxKillsPerSec + LIMITS.killsSlack) errs.push('kills');
  if (s.level > LIMITS.maxLevel) errs.push('level');
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
