// Movimiento del jugador, empuje de los pesados, radiación y muerte.
import { ENEMY_STATS, type EnemyStats } from '../../config/enemies';
import { RAD, radTier } from '../../config/radiation';
import { CAPS, PLAYER } from '../../config/run';
import { survivorStats, type SurvivorStats } from '../../config/survivors';
import { TREE_FX } from '../../config/tree';
import { blockCircle } from '../obstacles';
import { banner } from '../fx';
import { iceSlowAt } from '../scars';
import { tickStun } from '../rules';
import { hurtIndex, noteHurt } from '../runStats';
import { addRad, heal } from '../systems/combat';
import type { InputState, World } from '../types';

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/**
 * Los pesados (rol `heavy`) ocupan espacio de verdad: el jugador no los atraviesa (CAMBIOS §4). El resto de enemigos
 * solo se separan entre sí, sin colisión con el jugador, para que las hordas sigan fluyendo.
 */
function blockByHeavies(w: World): void {
  const p = w.player;
  for (let i = 0; i < w.enemies.count; i++) {
    const e = w.enemies.items[i]!;
    if (e.dead || e.flying || (ENEMY_STATS[e.type] as EnemyStats).role !== 'heavy') continue;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const min = p.r + e.r;
    const d2 = dx * dx + dy * dy;
    if (d2 >= min * min) continue;
    const d = Math.sqrt(d2) || 1;
    p.x = e.x + (dx / d) * min;
    p.y = e.y + (dy / d) * min;
  }
}

export function updatePlayer(w: World, input: InputState, dt: number): void {
  const p = w.player;
  p.prevX = p.x;
  p.prevY = p.y;
  p.vx = p.vy = 0;
  if (p.deadAt !== null) {
    p.moving = false;
    return;
  }
  tickStun(p, dt);
  // Aturdido: no se mueve ni dispara (las armas lo miran en `updateWeapons`).
  const mag = p.stun > 0 ? 0 : Math.sqrt(input.moveX * input.moveX + input.moveY * input.moveY);
  p.moving = mag > PLAYER.moveDeadzone;
  if (p.moving) {
    const ux = input.moveX / mag;
    const uy = input.moveY / mag;
    // Sobre una mancha de hielo de la nevera va más lento.
    const k = Math.min(1, mag) * w.st.speed * iceSlowAt(w, p.x, p.y) * dt;
    p.facingX = ux;
    p.facingY = uy;
    p.x += ux * k;
    p.y += uy * k;
    blockCircle(w, p, p.r, ux, uy, 1);
    blockByHeavies(w);
    p.vx = (p.x - p.prevX) / dt;
    p.vy = (p.y - p.prevY) / dt;
  }
  p.inv -= dt;
  p.turbo -= dt;
  p.rush -= dt;
  p.nuka -= dt;
  p.boots -= dt;
  p.healBudget = Math.min(CAPS.killHealPerSec, p.healBudget + CAPS.killHealPerSec * dt);
  if (w.st.regen > 0) heal(w, w.st.regen * dt);
}

export function updateRadiation(w: World, dt: number): void {
  const p = w.player;
  if (p.deadAt !== null) return;
  for (const h of w.hazards) {
    const dx = p.x - h.x;
    const dy = p.y - h.y;
    if (dx * dx + dy * dy < h.r * h.r) {
      addRad(w, RAD.puddle * dt);
      break;
    }
  }
  for (let i = 0; i < w.slimes.count; i++) {
    const s = w.slimes.items[i]!;
    const dx = p.x - s.x;
    const dy = p.y - s.y;
    if (dx * dx + dy * dy < s.r * s.r) {
      addRad(w, s.rad * dt);
      break;
    }
  }
  if (w.rain > 0) addRad(w, RAD.rain * dt);
  if (w.st.radDecayBonus) p.rad -= w.st.radDecayBonus * dt;
  p.rad = clamp(p.rad, 0, RAD.max);
  const immune = p.god || !!(survivorStats(w.charId) as SurvivorStats).radImmune;
  const tier = radTier(p.rad);
  if (tier.drain && !immune) {
    p.hp -= tier.drain * dt;
    noteHurt(w.rs, hurtIndex('rad'), tier.drain * dt, w.time);
  }
  if (p.rad >= RAD.max && !immune && !p.radSaved && w.mods.radSave) {
    // Árbol: sobrevive una vez a la RAD máxima.
    p.radSaved = true;
    p.rad = TREE_FX.saveTo;
    banner(w, 'banner.radSave');
  } else if (p.rad >= RAD.max && !immune) {
    banner(w, 'banner.radDeath');
    w.rs.lastSrc = hurtIndex('rad');
    killPlayer(w);
  }
}

/** Mata al jugador (daño letal o depuración). La animación `death` se reproduce desde `deadAt`. */
export function killPlayer(w: World): void {
  const p = w.player;
  if (p.deadAt !== null) return;
  p.hp = 0;
  p.deadAt = w.time;
  p.moving = false;
}
