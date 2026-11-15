// Cinemáticas de victoria y derrota: estado, intensidad y luces.
import { RUN_COLORS } from '../../config/render';
import { JUICE } from '../../config/run';
import type { Enemy } from '../../engine/types';
import { animDuration } from '../spriteMeta';
import { GameRenderer, clamp, smooth } from './gameRenderer';

/** Arranca la cinemática de victoria del personaje `charId`. Devuelve su duración en s. */
export function startVictory(r: GameRenderer, charId: string): number {
  const V = JUICE.victory;
  const meta = r.lib.meta(charId, 'victory');
  r.victor = null;
  r.victoryT = 0;
  r.victoryClock = 0;
  r.victoryHoldAt = (meta ? animDuration(meta) : V.fallback) + V.hold;
  r.victoryDur = r.victoryHoldAt + V.zoomOut;
  return r.victoryDur;
}

/**
 * Arranca la cinemática de derrota: la cámara va hasta `e` (el Coloso), que hace su victory mientras el personaje
 * cae y sale «¡Perdiste!». Devuelve su duración en s.
 */
export function startDefeat(r: GameRenderer, e: Enemy): number {
  const V = JUICE.victory;
  const meta = r.lib.meta(e.type, 'victory');
  r.victor = e;
  r.victoryT = 0;
  r.victoryClock = 0;
  r.victoryHoldAt = (meta ? animDuration(meta) : V.fallback) + JUICE.defeat.hold;
  r.victoryDur = r.victoryHoldAt + V.zoomOut;
  return r.victoryDur;
}

/** La animación ya terminó y la cámara sigue cerca: momento de enseñar la máquina de cupones. */
export function victoryHolding(r: GameRenderer): boolean {
  return r.victoryT >= r.victoryHoldAt;
}

/**
 * Avanza la cinemática `dt` s. Con `hold` se queda en primer plano al acabar la animación (la máquina de cupones
 * sigue abierta); sin él, vuelve al zoom normal. Devuelve los segundos que le quedan (0 = terminada).
 */
export function stepVictory(r: GameRenderer, dt: number, hold: boolean): number {
  if (r.victoryT < 0) return 0;
  r.victoryClock += dt;
  r.victoryT += dt;
  if (hold) r.victoryT = Math.min(r.victoryT, r.victoryHoldAt);
  if (r.victoryT < r.victoryDur) return r.victoryDur - r.victoryT;
  r.victoryT = -1;
  r.victor = null;
  r.defeatText.visible = false;
  r.cineBack.clear();
  r.cineFront.clear();
  return 0;
}

/** Intensidad 0–1 de la cinemática: sube al entrar y baja al salir. */
export function victoryLevel(r: GameRenderer): number {
  if (r.victoryT < 0) return 0;
  const V = JUICE.victory;
  const t = r.victoryT;
  return smooth(clamp(Math.min(t / V.zoomIn, (r.victoryDur - t) / V.zoomOut), 0, 1));
}

/**
 * Luces de la cinemática con los pies del personaje en (x, y) de mundo: rayos que giran tras él, halo en el suelo,
 * onda expansiva y chispas que suben; en pantalla, viñeta que oscurece lo demás y fogonazo inicial.
 */
export function drawVictory(
  r: GameRenderer,
  x: number,
  y: number,
  level: number,
  k: number,
  defeat: boolean,
): void {
  const V = JUICE.victory;
  const t = r.victoryClock;
  // El Coloso es mucho más grande que el personaje: luces a su escala y en rojo.
  const s = defeat ? 2.2 : 1;
  const colA = defeat ? RUN_COLORS.defeatA : RUN_COLORS.victoryA;
  const colB = defeat ? RUN_COLORS.defeatB : RUN_COLORS.victoryB;
  const cy = y - (defeat ? JUICE.defeat.lift : V.lift);
  const back = r.cineBack;
  const front = r.cineFront;
  back.clear();
  front.clear();

  const reach = (150 + 30 * Math.sin(t * 3)) * s;
  for (let i = 0; i < V.rays; i++) {
    const a = t * 0.6 + (i / V.rays) * Math.PI * 2;
    const half = 0.07 + 0.03 * Math.sin(t * 5 + i);
    const r = reach * (i % 2 ? 0.75 : 1);
    back
      .poly([
        x,
        cy,
        x + Math.cos(a - half) * r,
        cy + Math.sin(a - half) * r,
        x + Math.cos(a + half) * r,
        cy + Math.sin(a + half) * r,
      ])
      .fill({ color: i % 2 ? colB : colA, alpha: 0.22 * level });
  }
  for (let i = 3; i >= 1; i--)
    back.ellipse(x, y, 26 * i * s, 13 * i * s).fill({ color: colA, alpha: 0.12 * level });
  if (t < 0.7) {
    const u = t / 0.7;
    back
      .ellipse(x, y, (40 + 220 * u) * s, (20 + 110 * u) * s)
      .stroke({ color: colB, width: 6 * (1 - u) * s, alpha: 1 - u });
  }

  // Chispas: cada una sube en espiral alrededor del personaje y vuelve a empezar.
  for (let i = 0; i < 26; i++) {
    const life = (t * (0.5 + (i % 5) * 0.12) + i * 0.137) % 1;
    const a = i * 2.39996 + t * (i % 2 ? 1.3 : -1.1);
    const r = (26 + (i % 7) * 7) * s;
    const sx = x + Math.cos(a) * r;
    const sy = y - life * 120 * s + Math.sin(a) * r * 0.45;
    front
      .circle(sx, sy, (1.6 + (i % 3)) * (1 - life) * s)
      .fill({ color: i % 3 ? colA : 0xffffff, alpha: level * (1 - life) });
  }

  // Viñeta: anillos con el centro recortado; se suman hacia fuera y dejan la luz sobre el personaje.
  const { width, height } = r.app.screen;
  const ox = r.worldLayer.position.x + x * k;
  const oy = r.worldLayer.position.y + cy * k;
  const o = r.overlay;
  for (let i = 0; i < 6; i++)
    o.rect(0, 0, width, height)
      .fill({ color: 0x000000, alpha: 0.12 * level })
      .circle(ox, oy, height * (0.2 + i * 0.06))
      .cut();
  if (t < 0.18 && !r.reduceMotion)
    o.rect(0, 0, width, height).fill({ color: 0xffffff, alpha: 0.5 * (1 - t / 0.18) });
}

/** «¡Perdiste!»: entra grande y encaja de golpe; luego late despacio. */
export function drawDefeatText(r: GameRenderer, width: number, height: number): void {
  const D = JUICE.defeat;
  const t = r.victoryClock;
  const txt = r.defeatText;
  txt.visible = true;
  const u = clamp(t / D.textIn, 0, 1);
  // Que quepa en pantallas estrechas.
  const fit = Math.min(1, (width * 0.9) / (txt.width / (txt.scale.x || 1)));
  const pulse = r.reduceMotion ? 1 : 1 + 0.04 * Math.sin(t * 4);
  txt.scale.set(fit * (u < 1 ? 2.2 - 1.2 * smooth(u) : pulse));
  txt.alpha = u;
  txt.position.set(width / 2, height * 0.55);
}
