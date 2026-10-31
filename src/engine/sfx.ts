// Eventos sonoros del motor. El motor solo cuenta y apunta dónde pasó el último; la capa de audio decide qué y
// cuánto suena (y lo coloca en el estéreo según esa posición).
import type { WeaponId } from '../config/weapons';
import type { World } from './types';

export const SFX = {
  shot: 0,
  hit: 1,
  kill: 2,
  pickup: 3,
  hurt: 4,
  boom: 5,
  zap: 6,
  boss: 7,
  dodge: 8,
  nail: 9,
  rivet: 10,
  dart: 11,
  shotgun: 12,
  rifle: 13,
  throw: 14,
  molotov: 15,
  pop: 16,
  slam: 17,
  sonic: 18,
  tesla: 19,
  defib: 20,
  hitMetal: 21,
  killMetal: 22,
  eshot: 23,
} as const;

export type SfxId = keyof typeof SFX;
export type SfxCode = (typeof SFX)[SfxId];
export const SFX_COUNT = 24;

/** Disparo de cada arma de proyectiles; las que faltan suenan con `shot`. */
export const SHOT_SFX: Partial<Record<WeaponId, SfxCode>> = {
  pistola_clavos: SFX.nail,
  remachadora: SFX.rivet,
  jeringa: SFX.dart,
  dardos_incendiarios: SFX.dart,
  escopeta_chatarra: SFX.shotgun,
  rifle_cerrojo: SFX.rifle,
};

/** Cuenta el sonido y guarda dónde sonó (sin posición: en el jugador); de varios en el mismo paso, el más cercano. */
export function sfx(w: World, id: SfxCode, x = w.player.x, y = w.player.y): void {
  w.sfx[id] = w.sfx[id]! + 1;
  const dx = x - w.player.x;
  const dy = y - w.player.y;
  const d2 = dx * dx + dy * dy;
  if (w.sfxT[id] === w.time && d2 >= w.sfxD[id]!) return;
  w.sfxT[id] = w.time;
  w.sfxD[id] = d2;
  w.sfxX[id] = x;
  w.sfxY[id] = y;
}
