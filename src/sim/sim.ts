// Simulación sin interfaz con semilla fija (T0): un bot juega la run y se devuelven los resultados.
// TS puro, como el motor: lo usan los tests (`tests/sim/`) y `npm run sim`.
import { RUN } from '../config/run';
import type { StatSurvivorId } from '../config/survivors';
import type { WeaponId } from '../config/weapons';
import { applyChoice } from '../engine/systems/progression';
import type { InputState, World } from '../engine/types';
import { createWorld, results, tick, type RunResults, type WorldOptions } from '../engine/world';

/** Estrategias de movimiento del bot: huir de lo cercano, dar vueltas, ir en línea recta o quedarse quieto. */
export type BotKind = 'kite' | 'circle' | 'line' | 'still';

export interface SimOptions {
  charId: StatSurvivorId;
  seed: number;
  /** Segundos de run a simular (como mucho; acaba antes si muere). */
  seconds: number;
  bot?: BotKind;
  startWeapon?: WeaponId | null;
  world?: WorldOptions;
}

export interface SimResult extends RunResults {
  bot: BotKind;
  /** Vida al acabar la simulación (0 si murió). */
  hp: number;
  /** Nivel, vida y enemigos vivos al final de cada minuto. */
  perMin: { level: number; hp: number; alive: number; kills: number }[];
}

const KITE_R = 300;

/** Movimiento del bot. Determinista: solo lee el mundo. */
export function botInput(w: World, kind: BotKind, out: InputState): InputState {
  const p = w.player;
  out.moveX = 0;
  out.moveY = 0;
  if (kind === 'still') return out;
  if (kind === 'line') {
    out.moveX = 1;
    return out;
  }
  if (kind === 'circle') {
    const a = w.time * 0.6;
    out.moveX = -Math.sin(a);
    out.moveY = Math.cos(a);
    return out;
  }
  // kite: se aleja de los enemigos cercanos (más de los jefes), esquiva avisos y gira para no quedar acorralado.
  let ax = 0;
  let ay = 0;
  for (let i = 0; i < w.enemies.count; i++) {
    const e = w.enemies.items[i]!;
    if (e.dead || e.flying) continue;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > KITE_R * KITE_R) continue;
    const d = Math.sqrt(d2) || 1;
    const k = ((e.boss ? 6 : 1) / (d * d)) * 1e4;
    ax += (dx / d) * k;
    ay += (dy / d) * k;
  }
  for (let i = 0; i < w.tele.count; i++) {
    const t = w.tele.items[i]!;
    const dx = p.x - t.x;
    const dy = p.y - t.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < t.r + 40) {
      ax += (dx / d) * 20;
      ay += (dy / d) * 20;
    }
  }
  // Giro tangencial y una leve atracción al punto de inicio para no alejarse sin fin.
  const tx = -ay * 0.6;
  const ty = ax * 0.6;
  ax += tx + (w.start.x - p.x) / 800;
  ay += ty + (w.start.y - p.y) / 800;
  const l = Math.hypot(ax, ay);
  if (l > 0.01) {
    out.moveX = ax / l;
    out.moveY = ay / l;
  }
  return out;
}

/** Elección automática: primero fusiones, luego armas nuevas, luego la primera tarjeta. Tras el Coloso, terminar. */
function autoChoose(w: World): void {
  const ch = w.choice!;
  if (ch.type === 'endless') return applyChoice(w, 1);
  let i = ch.cards.findIndex((c) => c.kind === 'fusion');
  if (i < 0) i = ch.cards.findIndex((c) => c.kind === 'new');
  applyChoice(w, Math.max(0, i));
}

export function simulate(o: SimOptions): SimResult {
  const bot = o.bot ?? 'kite';
  const opts: WorldOptions = { ...o.world };
  if (o.startWeapon !== undefined) opts.startWeapon = o.startWeapon;
  const w = createWorld(o.charId, o.seed, opts);
  const step = 1 / RUN.tickHz;
  const input: InputState = { moveX: 0, moveY: 0 };
  const perMin: SimResult['perMin'] = [];
  let nextMin = 60;
  while (!w.over && w.time < o.seconds) {
    if (w.choice) {
      autoChoose(w);
      continue;
    }
    tick(w, botInput(w, bot, input), step);
    if (w.time >= nextMin) {
      perMin.push({ level: w.level, hp: Math.round(w.player.hp), alive: w.enemies.count, kills: w.kills });
      nextMin += 60;
    }
  }
  return { ...results(w), bot, hp: Math.max(0, Math.round(w.player.hp)), perMin };
}
