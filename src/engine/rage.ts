// Furia configurable por enemigo (CAMBIOS §1): decide cuándo se enfurece y lleva el ciclo dur/cd. Funciones puras sin
// objetos nuevos (se llaman en el bucle de IA): el estado va en un `RageState` y el perfil llega como `def` + `ovr`.
import type { RageOverride, RageProfile } from '../config/enemies';

/** Estado de furia de un enemigo (lo cumple `Enemy`). */
export interface RageState {
  /** Vida y vida máxima (la condición `hpBelow` compara su cociente; así no hay que pasar un número calculado). */
  hp: number;
  maxHp: number;
  /** Enfurecido ahora. */
  rage: boolean;
  /** Segundos que le quedan de furia. */
  rageT: number;
  /** Enfriamiento: segundos hasta que pueda volver a enfurecerse. */
  rageCd: number;
  /** Segundos persiguiendo desde que apareció o acabó su última furia (solo cuentan con el nivel mínimo alcanzado). */
  chase: number;
  /** Veces que se ha enfurecido. */
  rageN: number;
}

/** Resultado de un paso: nada, acaba de enfurecerse (aplicar efectos) o acaba de calmarse (quitarlos). */
export const RAGE_NONE = 0;
export const RAGE_START = 1;
export const RAGE_END = 2;

/** Valor numérico del perfil: el del enemigo si lo sobrescribe, y si no el de por defecto. */
export function rageOf(def: RageProfile, ovr: RageOverride | undefined, k: keyof RageProfile): number {
  const v = ovr === undefined ? undefined : ovr[k];
  return v === undefined ? def[k] : v;
}

/** ¿Puede enfurecerse este enemigo? (`rage: { enabled: false }` la apaga). */
export const rageEnabled = (ovr: RageOverride | undefined): boolean =>
  ovr === undefined || ovr.enabled !== false;

/** Condición «muere un aliado cerca»: `d2` = distancia² al aliado muerto. */
export function rageAllyNear(def: RageProfile, ovr: RageOverride | undefined, d2: number): boolean {
  const r = rageOf(def, ovr, 'allyDeathR');
  return r > 0 && d2 < r * r;
}

/** Empieza la furia si está permitida y se ha llegado al nivel mínimo (lecturas con nombre: camino caliente). */
function startIf(s: RageState, def: RageProfile, ovr: RageOverride | undefined, level: number): number {
  if (ovr !== undefined && ovr.enabled === false) return RAGE_NONE;
  if (level < (ovr !== undefined && ovr.minLevel !== undefined ? ovr.minLevel : def.minLevel))
    return RAGE_NONE;
  return begin(s, ovr !== undefined && ovr.dur !== undefined ? ovr.dur : def.dur);
}

function begin(s: RageState, dur: number): number {
  s.rage = true;
  s.rageT = dur;
  s.rageN++;
  return RAGE_START;
}

/**
 * Un paso de `dt` s. Si ya está enfurecido cuenta su duración y, al acabar, empieza el enfriamiento. Si no, cuenta la
 * persecución (solo con `level` ≥ `minLevel`) y se enfurece al cumplir `chaseAfter` s o al bajar de `hpBelow` de vida
 * (vida / vida máxima), siempre que no esté en enfriamiento. Devuelve RAGE_NONE, RAGE_START o RAGE_END.
 */
export function rageStep(
  s: RageState,
  dt: number,
  def: RageProfile,
  ovr: RageOverride | undefined,
  level: number,
): number {
  if (s.rage) {
    s.rageT -= dt;
    if (s.rageT > 0) return RAGE_NONE;
    s.rage = false;
    s.rageT = 0;
    s.rageCd = ovr !== undefined && ovr.cd !== undefined ? ovr.cd : def.cd;
    s.chase = 0;
    return RAGE_END;
  }
  // Lecturas con nombre (no `rageOf`): este es el camino caliente y una clave variable carga más y reserva memoria.
  if (ovr !== undefined && ovr.enabled === false) return RAGE_NONE;
  if (level < (ovr !== undefined && ovr.minLevel !== undefined ? ovr.minLevel : def.minLevel))
    return RAGE_NONE;
  s.chase += dt;
  if (s.rageCd > 0) {
    s.rageCd -= dt;
    return RAGE_NONE;
  }
  const after = ovr !== undefined && ovr.chaseAfter !== undefined ? ovr.chaseAfter : def.chaseAfter;
  const below = ovr !== undefined && ovr.hpBelow !== undefined ? ovr.hpBelow : def.hpBelow;
  if ((after > 0 && s.chase >= after) || (below > 0 && s.hp < below * s.maxHp))
    return begin(s, ovr !== undefined && ovr.dur !== undefined ? ovr.dur : def.dur);
  return RAGE_NONE;
}

/** Furia por un disparador externo (muerte de un aliado cerca): respeta nivel mínimo y enfriamiento. */
export function rageTrigger(
  s: RageState,
  def: RageProfile,
  ovr: RageOverride | undefined,
  level: number,
): number {
  if (s.rage || s.rageCd > 0) return RAGE_NONE;
  return startIf(s, def, ovr, level);
}

/** Furia forzada (sermón del predicador): ignora el enfriamiento, pero no el nivel mínimo ni `enabled: false`. */
export function rageForce(
  s: RageState,
  def: RageProfile,
  ovr: RageOverride | undefined,
  level: number,
): number {
  if (s.rage) return RAGE_NONE;
  return startIf(s, def, ovr, level);
}

/** Velocidad efectiva: enfurecido corre a max(la suya, la del jugador × `speed`). */
export function rageSpeed(
  s: RageState,
  base: number,
  playerSpeed: number,
  def: RageProfile,
  ovr: RageOverride | undefined,
): number {
  if (!s.rage) return base;
  const v = playerSpeed * rageOf(def, ovr, 'speed');
  return v > base ? v : base;
}
