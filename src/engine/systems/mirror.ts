// Evento «Tú mismo, otra vez»: una vez por partida sale una bomba en el suelo; al pisarla explota y aparece una copia
// hostil del personaje. Al matarla cae el cofre especial de las guarniciones (la copia es una guarnición de 1).
// El instante y el sitio de la bomba salen de un generador propio (`World.mirror.rng`), no de `World.rng`: la secuencia
// de la partida no cambia mientras el jugador no la toque.
import { AI, MIRROR_ID } from '../../config/enemies';
import { MIRROR, OBJECTIVES } from '../../config/modes';
import { JUICE } from '../../config/run';
import { EVENTS } from '../../config/waves';
import { addShake, banner, boom, burst, hitStop } from '../fx';
import { areaClutter } from '../obstacles';
import { createRng } from '../rng';
import type { Vec } from '../rules';
import { hurtIndex } from '../runStats';
import { SFX, sfx } from '../sfx';
import type { Enemy, MirrorState, World } from '../types';
import { hurtPlayer } from './combat';
import { spawnEnemy } from './enemies';

const TAU = Math.PI * 2;
/** Sal para derivar el generador del evento de la semilla de la partida. */
const SEED_SALT = 0x2f6b9d3b;
/** Solo visual: radio de la explosión respecto al de la bomba, colores y número de esquirlas. */
const BOOM_SCALE = 4;
const BOOM_COLOR = 0xff2a2a;
const BLAST_SPARKS = [0xff2a2a, 0xffaa3c, 0xc070ff, 0x2a1018] as const;
const BLAST_PARTS = 22;

/** Estado inicial del evento: el instante de la bomba se sortea ya, con el generador propio. */
export function createMirror(seed: number): MirrorState {
  const rng = createRng(seed ^ SEED_SALT);
  return { phase: 0, at: MIRROR.from + rng() * (MIRROR.to - MIRROR.from), x: 0, y: 0, rng };
}

/** Balas de cada ráfaga: base más una por arma que lleva el jugador. */
export const mirrorShotCount = (w: World): number =>
  AI.copia.shots + AI.copia.shotsPerWeapon * w.weapons.length;

/** Daño de cada bala: crece con el nivel del jugador. */
export const mirrorBulletDmg = (w: World): number => AI.copia.dmg + AI.copia.dmgPerLevel * w.level;

/** Vida al aparecer: sin el escalado por tiempo de `spawnEnemy`. */
export const mirrorHp = (w: World): number => AI.copia.hpBase + AI.copia.hpPerLevel * w.level;

/** Velocidad: una fracción (< 1) de la velocidad actual del jugador. */
export const mirrorSpeed = (w: World): number => AI.copia.speedMult * w.st.speed;

/** Ángulo (rad) de la bala `i` de una ráfaga de `n` respecto a la dirección al jugador: abanico centrado. */
export const mirrorAngle = (i: number, n: number): number => (i - (n - 1) / 2) * AI.copia.spread;

/** Velocidad deseada que calcula `mirrorThink` (sin reservar memoria). */
export const mirrorVel: Vec = { x: 0, y: 0 };

/**
 * IA de la copia: se acerca hasta `hold` px, se aleja si el jugador está a menos de `retreat`; cada `every` s, si el jugador está a menos de `range`,
 * pide una ráfaga (devuelve true; la dispara el llamador con `fireBullet`). `e.timer` es su enfriamiento.
 */
export function mirrorThink(w: World, e: Enemy, d: number, ux: number, uy: number, dt: number): boolean {
  const A = AI.copia;
  e.speed = mirrorSpeed(w);
  const spd = e.speed * e.slowK;
  if (d > A.hold) {
    mirrorVel.x = ux * spd;
    mirrorVel.y = uy * spd;
  } else if (d < A.retreat) {
    // Nace encima del jugador: sin esto se quedaría pegada a él, dentro de las armas que orbitan.
    mirrorVel.x = -ux * spd;
    mirrorVel.y = -uy * spd;
  } else {
    mirrorVel.x = 0;
    mirrorVel.y = 0;
  }
  e.timer -= dt;
  if (e.timer <= 0 && d < A.range) {
    e.timer = A.every;
    return true;
  }
  return false;
}

/**
 * Coloca la bomba a `distMin`–`distMax` px del jugador, en el sitio más despejado de unos cuantos candidatos (como las
 * zonas de objetivo). Solo consume `m.rng`.
 */
function placeBomb(w: World): void {
  const m = w.mirror;
  const p = w.player;
  const a0 = m.rng() * TAU;
  const u = m.rng();
  const span = MIRROR.distMax - MIRROR.distMin;
  let x = p.x + Math.cos(a0) * MIRROR.distMin;
  let y = p.y + Math.sin(a0) * MIRROR.distMin;
  let best = Infinity;
  for (let k = 0; k < OBJECTIVES.tries && best > 0; k++) {
    const t = a0 + (k * TAU) / OBJECTIVES.spokes;
    let f = u + Math.floor(k / OBJECTIVES.spokes) * OBJECTIVES.distStep;
    f -= Math.floor(f);
    const d = MIRROR.distMin + f * span;
    const cx = p.x + Math.cos(t) * d;
    const cy = p.y + Math.sin(t) * d;
    const c = areaClutter(w, cx, cy, MIRROR.r + OBJECTIVES.margin);
    if (c < best) {
      best = c;
      x = cx;
      y = cy;
    }
  }
  putBomb(w, x, y);
}

/** Deja la bomba en (x, y), lista para pisar (también para depuración y pruebas). */
export function putBomb(w: World, x: number, y: number): void {
  const m = w.mirror;
  m.x = x;
  m.y = y;
  m.phase = 1;
}

/** Explosión de la bomba y aparición de la copia en ese punto. Devuelve la copia. */
export function detonateBomb(w: World): Enemy {
  const m = w.mirror;
  m.phase = 2;
  boom(w, m.x, m.y, MIRROR.r * BOOM_SCALE, 0.4, BOOM_COLOR);
  burst(w, m.x, m.y, BLAST_PARTS, BLAST_SPARKS, 1.6);
  addShake(w, 8, 14);
  hitStop(w, JUICE.hitStop.grenade);
  hurtPlayer(w, MIRROR.blastDmg, 0, true, hurtIndex(MIRROR_ID));
  // Una guarnición de 1: el cofre especial cae al morir, sin que se recicle ni se recoloque.
  const gar = w.garrisons.length;
  w.garrisons.push({ x: m.x, y: m.y, left: 1 });
  const e = spawnEnemy(w, MIRROR_ID, m.x, m.y, false);
  e.gar = gar;
  e.skin = w.charId;
  e.hp = e.maxHp = mirrorHp(w);
  e.speed = mirrorSpeed(w);
  sfx(w, SFX.boss);
  banner(w, 'banner.mirror');
  return e;
}

/**
 * Cambio de acto: una bomba sin pisar se queda en el mapa viejo, así que el evento vuelve a esperar y sale de nuevo
 * dentro de la ventana de `MIRROR` a partir de ahora. Si ya se pisó, el evento está hecho (la copia viva desaparece
 * con el resto de enemigos).
 */
export function resetMirrorBomb(w: World): void {
  const m = w.mirror;
  if (m.phase !== 1) return;
  m.phase = 0;
  m.at = w.time + m.rng() * (MIRROR.to - MIRROR.from);
}

/** Un tick del evento: sortea sitio cuando llega su hora (esperando a que pase un jefe) y detecta que la pisen. */
export function updateMirror(w: World): void {
  const m = w.mirror;
  if (m.phase === 0) {
    if (w.time < m.at) return;
    // Mismo criterio que `EVENTS.bossQuiet`: con un jefe vivo o recién muerto, se retrasa.
    if (w.bossAlive > 0) m.at = w.time + EVENTS.bossQuiet;
    else if (w.time - w.lastBossAt < EVENTS.bossQuiet) m.at = w.lastBossAt + EVENTS.bossQuiet;
    else placeBomb(w);
    return;
  }
  if (m.phase !== 1) return;
  const p = w.player;
  if ((p.x - m.x) ** 2 + (p.y - m.y) ** 2 < MIRROR.r * MIRROR.r) detonateBomb(w);
}
