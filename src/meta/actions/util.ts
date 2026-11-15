// Utilidades de las reglas del Búnker: día, semilla, sorteos, gasto de cupones.
import { STAT_SURVIVOR_IDS, type StatSurvivorId } from '../../config/survivors';
import { type Rng } from '../../engine/rng';
import { type SaveData } from '../save';

// ---------- utilidades ----------

/** Día local `AAAA-MM-DD`: las misiones y el mercader cambian a medianoche local. */
export function dayKey(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** FNV-1a de 32 bits: semilla estable a partir de un texto. */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h | 0;
}

export function pickN<T>(rng: Rng, list: readonly T[], n: number): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a.slice(0, n);
}

export const owned = (s: SaveData): StatSurvivorId[] => STAT_SURVIVOR_IDS.filter((id) => s.survivors[id]);

export function spend(s: SaveData, cost: number): boolean {
  if (s.profile.credits < cost) return false;
  s.profile.credits -= cost;
  return true;
}
