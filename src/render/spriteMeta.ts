// Contrato de los JSON de sprite sheets (biblia de arte §4). Puro: sin Pixi ni DOM.
import type { AnimId } from '../config/entities';
import { DIRECTIONS, DIRECTIONS_ES, SPRITES } from '../config/render';

export interface SpriteMeta {
  id: string;
  anim: string;
  cell: readonly [number, number];
  pivot: readonly [number, number];
  directions: readonly string[];
  frames: number;
  fps: number;
  loop: boolean;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isPair = (v: unknown): v is [number, number] =>
  Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1]);

/**
 * Valida y completa un JSON de metadatos. Devuelve null si no se puede usar (el juego pondrá placeholder).
 * `imageWidth` permite deducir los frames si el JSON no los trae.
 */
export function parseSpriteMeta(raw: unknown, imageWidth?: number): SpriteMeta | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || typeof r.anim !== 'string' || !isPair(r.cell)) return null;
  const cell: [number, number] = [r.cell[0], r.cell[1]];
  if (cell[0] <= 0 || cell[1] <= 0) return null;

  const anim = r.anim;
  const byWidth = imageWidth ? Math.floor(imageWidth / cell[0]) : 0;
  const frames =
    isNum(r.frames) && r.frames > 0
      ? Math.floor(r.frames)
      : byWidth > 0
        ? byWidth
        : (SPRITES.defaultFrames[anim as AnimId] ?? 1);
  const fps = isNum(r.fps) && r.fps > 0 ? r.fps : SPRITES.defaultFps;
  const directions =
    Array.isArray(r.directions) && r.directions.every((d) => typeof d === 'string')
      ? (r.directions as string[])
      : [...DIRECTIONS];

  const override = SPRITES.pivotOverride[`${r.id}_${anim}`] ?? SPRITES.pivotOverride[r.id];
  const pivot: readonly [number, number] = override
    ? override
    : isPair(r.pivot)
      ? [r.pivot[0], r.pivot[1]]
      : [cell[0] * SPRITES.pivotFrac[0], cell[1] * SPRITES.pivotFrac[1]];

  const oneShot = SPRITES.oneShot.includes(anim as AnimId);
  const loop = anim === 'death' ? false : typeof r.loop === 'boolean' ? r.loop : !oneShot;

  return { id: r.id, anim, cell, pivot, directions, frames, fps, loop };
}

/**
 * Frame a mostrar `t` segundos después de empezar la animación.
 * Las no cíclicas (death incluida) se quedan en el último frame.
 */
export function frameIndex(meta: SpriteMeta, t: number): number {
  const f = Math.floor(Math.max(0, t) * meta.fps);
  return meta.loop ? f % meta.frames : Math.min(f, meta.frames - 1);
}

/** Duración en segundos de una pasada completa. */
export const animDuration = (meta: SpriteMeta): number => meta.frames / meta.fps;

/** Fila de la hoja para una dirección 0–7 (S, SW, W, NW, N, NE, E, SE). Acepta nombres en inglés o español. */
export function rowIndex(meta: SpriteMeta, dir: number): number {
  const d = ((dir % 8) + 8) % 8;
  const en = meta.directions.indexOf(DIRECTIONS[d] ?? 'S');
  if (en >= 0) return en;
  const es = meta.directions.indexOf(DIRECTIONS_ES[d] ?? 'S');
  if (es >= 0) return es;
  return meta.directions.length <= 1 ? 0 : Math.min(d, meta.directions.length - 1);
}
