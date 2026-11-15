// Tipos compartidos del motor. Importar siempre desde `engine/types` (este índice), nunca de un archivo suelto.
export type { InputState, PlayerStats, Player } from './player';
export { MODE_CHASE, MODE_AIM, MODE_DASH, ORBIT_SLOTS } from './enemy';
export type { EnemyMode, AttackAnim, Enemy } from './enemy';
export { SHOT_HITS } from './projectiles';
export type { Weapon, Shot, EnemyBullet, Lob, FirePool, Mine, TeleFall, Telegraph } from './projectiles';
export type {
  Scar,
  Downpour,
  Slime,
  Horde,
  Barrel,
  Objective,
  Point,
  Building,
  Hazard,
  PickupKind,
  MirrorState,
  Garrison,
  Pickup,
} from './map';
export { BEAM_POINTS } from './fx';
export type { Beam, Boom, Corpse, Wreck, Particle, FxKind, FxText, Banner } from './fx';
export type { Card, Choice } from './cards';
export type { World } from './world';
