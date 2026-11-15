// Opciones de createWorld y fábricas de los pools pequeños del mundo.
import type { ActId } from '../../config/acts';
import type { StatKey } from '../../config/traits';
import { type TreeMod } from '../../config/tree';
import type { DailyMod } from '../../config/modes';
import { type WeaponId } from '../../config/weapons';
import type { Corpse, Point, World, Wreck } from '../types';

export interface WorldOptions {
  /** Acto en el que empieza la partida. Por defecto, el 1. */
  act?: ActId;
  /** Enemigos simultáneos antes de reciclar el más lejano. Por defecto, ENEMY_RULES.maxAlive. */
  maxEnemies?: number;
  /** Arma inicial distinta de la del superviviente (manuales del mercader, F3-04); null = sin armas. */
  startWeapon?: WeaponId | null;
  /** Bonus permanentes del taller y las estrellas (F3-03), sumados a los rasgos. */
  bonus?: Partial<Record<StatKey, number>>;
  /** Huecos de consumible: cuántos de cada uno lleva al empezar. */
  consumables?: Partial<World['cons']>;
  extraRerolls?: number;
  /** Mejoras del árbol de pasivas que no son rasgos. */
  mods?: Partial<Record<TreeMod, number>>;
  /** Reto diario: día UTC y modificador. */
  daily?: { day: string; mod: DailyMod };
  /** Charcos radiactivos y objetos (obstáculos, edificios) en el mapa (los tests los quitan para aislar sistemas). */
  hazards?: boolean;
}

export const STAT_KEYS: readonly StatKey[] = [
  'dmg',
  'spd',
  'xp',
  'red',
  'armor',
  'regen',
  'mag',
  'dodge',
  'crit',
  'critDmg',
  'hp',
  'cd',
  'radDecay',
  'area',
  'pierce',
  'adren',
  'luck',
  'kb',
];

export const createCorpse = (): Corpse => ({
  sprite: 'dron',
  x: 0,
  y: 0,
  facingX: 0,
  facingY: 1,
  t: 0,
  flying: false,
  irr: false,
});
export const createWreck = (): Wreck => ({
  sprite: 'dron',
  x: 0,
  y: 0,
  t: 0,
  until: 0,
  seed: 0,
  flying: false,
  elite: false,
});
export const createPoint = (): Point => ({ x: 0, y: 0 });
