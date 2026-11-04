// Fase 4 del dossier, lo que hace repetir partidas: barriles explosivos y objetivos en el mapa (§11), reto diario
// (§14) y modo infinito tras el Coloso (§17). Distancias en px de mundo y tiempos en s.
import type { StatSurvivorId } from './survivors';
import { TUNING } from './tuning';

/**
 * Barriles explosivos sueltos por el páramo: revientan con un disparo, una explosión o un charco de fuego y se
 * llevan por delante lo que haya alrededor (y encadenan otros barriles).
 */
export const BARRELS = {
  /** Barriles a la vez alrededor del jugador. */
  max: 9,
  /** Cada cuánto se intenta poner un grupo nuevo si faltan. */
  every: 6,
  /** Barriles por grupo (para que encadenen). */
  groupMin: 1,
  groupMax: 3,
  groupSpread: 70,
  /** Más lejos que esto se retiran (y se ponen otros más cerca). */
  despawn: 1400,
  r: 13,
  blastR: 120,
  dmg: 70,
  /** El daño sube con el minuto como la vida de los enemigos (ENEMY_RULES.hpPerSec). */
  dmgPerSec: 1 / 250,
  /** Daño al jugador si está dentro de la explosión. */
  playerDmg: 8,
} as const;

export type RainKind = 'scrap' | 'acid';

/**
 * Lluvias que cambian el mapa, en `src/data/tuning.json` → `rains`. Caen en los segundos de `times`, haya jefe o no;
 * después, cada `everyMin`–`everyMax` s, esperando a que pase el jefe. Van por turnos (`order`). Mientras duran (`dur`), cada `every` s cae
 * algo a menos de su `radius` del jugador, marcado `warn` s antes (`aimChance`: probabilidad de que vaya a por él). Si
 * alcanza al jugador hace `dmg` y da `rad`.
 * - `rubbleInset`: distancia mínima de los escombros al borde de su casilla (el doble es el hueco para pasar).
 * - `objectiveMargin`: los destrozos se quedan a esta distancia de la zona de un objetivo.
 */
export const RAINS = TUNING.rains as Omit<typeof TUNING.rains, 'order'> & { order: readonly RainKind[] };

export type ObjectiveKind = 'hold' | 'purge';

/**
 * Objetivos del mapa: una zona marcada a cierta distancia del jugador.
 * - `hold`: aguanta `goal` s dentro de la zona (fuera, el progreso se para).
 * - `purge`: elimina `goal` enemigos dentro de la zona.
 * Si se acaba el tiempo `limit`, se pierde. Al cumplirlo, cofre especial en el centro y cupones.
 */
export const OBJECTIVES = {
  first: 100,
  everyMin: 80,
  everyMax: 110,
  dist: 650,
  r: 150,
  /**
   * Para que la zona caiga en un sitio despejado: intentos, direcciones por vuelta, cuánto se aleja en cada vuelta
   * (fracción de `dist`) y margen alrededor de ella en px.
   */
  tries: 48,
  spokes: 16,
  distStep: 0.2,
  margin: 30,
  order: ['hold', 'purge'] as readonly ObjectiveKind[],
  hold: { goal: 12, limit: 50 },
  purge: { goal: 35, limit: 45 },
  coupons: 40,
} as const;

/**
 * Modo infinito: al caer el Coloso se puede seguir. Cada minuto suben ritmo, tope y vida de los enemigos. No vuelven
 * los jefes: la presión la ponen los élites, uno cada `eliteEvery` s.
 */
export const ENDLESS = {
  ratePerMin: 0.12,
  maxPerMin: 0.08,
  hpPerMin: 0.15,
  eliteEvery: 15,
  /** Hordas más a menudo (multiplica el intervalo). */
  specialsMult: 0.7,
} as const;

export type DailyMod = 'elites' | 'hordes' | 'glass' | 'irradiated' | 'barrels';
export const DAILY_MODS: readonly DailyMod[] = ['elites', 'hordes', 'glass', 'irradiated', 'barrels'];

/**
 * Reto diario: misma semilla, superviviente y modificador para todos en el día (UTC), sin las mejoras del Búnker
 * (Taller, estrellas, árbol, implantes): solo cuenta cómo juegas. El primer intento del día da cupones extra.
 */
export const DAILY = {
  roster: ['dot', 'gus', 'benny'] as readonly StatSurvivorId[],
  /** Cupones extra por terminar el primer reto del día. */
  reward: 150,
  elites: { every: 0.5 },
  hordes: { every: 0.5 },
  /** Cristal: haces y recibes el doble de daño. */
  glass: { dealt: 2, taken: 2 },
  irradiated: { chance: 0.25 },
  barrels: { max: 2.5 },
} as const;
