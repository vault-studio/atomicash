// Utilidades de dibujo isométrico de los efectos y altura de vuelo.
import { Graphics } from 'pixi.js';
import { AI, ENEMY_RULES } from '../../config/enemies';
import { ENTITIES, type EntityId } from '../../config/entities';
import { isoX, isoY } from '../iso';

export const TAU = Math.PI * 2;
export const SQ = Math.SQRT1_2;

/** Círculo del suelo (radio r en mundo) como elipse isométrica. */
export function groundCircle(g: Graphics, x: number, y: number, r: number): Graphics {
  return g.ellipse(isoX(x, y), isoY(x, y), r, r / 2);
}

/** Rectángulo del suelo de (x, y) a (x + lx, y + ly) con semiancho (nx, ny), en isométrica. */
export function groundQuad(
  g: Graphics,
  x: number,
  y: number,
  lx: number,
  ly: number,
  nx: number,
  ny: number,
): Graphics {
  const ex = x + lx;
  const ey = y + ly;
  return g.poly([
    isoX(x + nx, y + ny),
    isoY(x + nx, y + ny),
    isoX(ex + nx, ey + ny),
    isoY(ex + nx, ey + ny),
    isoX(ex - nx, ey - ny),
    isoY(ex - nx, ey - ny),
    isoX(x - nx, y - ny),
    isoY(x - nx, y - ny),
  ]);
}

/** Ángulo en pantalla de una dirección de mundo. */
export const screenAngle = (vx: number, vy: number): number => Math.atan2(isoY(vx, vy), isoX(vx, vy));

export const FLY_HEIGHT = ENEMY_RULES.flyHeight;

/** Altura de vuelo de un sprite volador: el Dirigible (y su variante dañada) vuela más bajo por su tamaño. */
export const flyLift = (id: EntityId): number =>
  (ENTITIES[id].variantOf ?? id) === 'dirigible' ? AI.dirigible.lift : FLY_HEIGHT;
