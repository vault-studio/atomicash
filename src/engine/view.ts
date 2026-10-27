// Proyección isométrica 2:1 y zona visible de la cámara.
// DECISIÓN: aunque la vista isométrica es cosa del render, el motor necesita saber qué ve la cámara
// para que los enemigos aparezcan fuera de ella (F1-05). Por eso la proyección vive aquí y el render la reutiliza.
import { VIEW } from '../config/render';
import type { World } from './types';

const ISO = Math.SQRT1_2;

export const isoX = (x: number, y: number): number => (x - y) * ISO;
export const isoY = (x: number, y: number): number => (x + y) * ISO * 0.5;

/** Semiancho y semialto de lo que ve la cámara, en unidades isométricas de mundo (pantalla ÷ zoom). */
export interface ViewExtent {
  halfW: number;
  halfH: number;
}

export const defaultView = (): ViewExtent => ({ halfW: VIEW.width / 2, halfH: VIEW.height / 2 });

/** El app la actualiza cada frame con el tamaño real de la cámara. */
export function setView(w: World, halfW: number, halfH: number): void {
  w.view.halfW = halfW;
  w.view.halfH = halfH;
}

/** ¿El punto de mundo (x, y) cae dentro de la cámara centrada en el jugador? */
export function isOnScreen(w: World, x: number, y: number, margin = 0): boolean {
  const p = w.player;
  const dx = x - p.x;
  const dy = y - p.y;
  return Math.abs(isoX(dx, dy)) < w.view.halfW + margin && Math.abs(isoY(dx, dy)) < w.view.halfH + margin;
}

/**
 * Distancia mínima desde el jugador, en la dirección unitaria (ux, uy) de mundo,
 * a la que un punto queda fuera del rectángulo visible.
 */
export function offscreenDistance(w: World, ux: number, uy: number): number {
  const ix = Math.abs(isoX(ux, uy));
  const iy = Math.abs(isoY(ux, uy));
  const dx = ix > 1e-9 ? w.view.halfW / ix : Infinity;
  const dy = iy > 1e-9 ? w.view.halfH / iy : Infinity;
  return dx < dy ? dx : dy;
}
