// Objetos del suelo (chatarra, recogibles, cofres), sombras de voladores y explosiones.
import { FX_ART, RUN_COLORS } from '../../config/render';
import { FX } from '../../config/run';
import type { Boom, World } from '../../engine/types';
import { isoX, isoY } from '../iso';
import type { FxLayer } from './fxLayer';
import { groundCircle } from './shapes';

/** Color del halo de los objetos con dibujo; las gemas, los estimulantes y los cupones no llevan. */
const PICKUP_HALO: Partial<Record<string, number>> = {
  medkit: 0xffffff,
  magnet: 0xffffff,
  bomb: 0xffffff,
  freeze: RUN_COLORS.freeze,
  nuka: RUN_COLORS.nuka,
  boots: RUN_COLORS.boots,
  chest: 0xc77dff,
  crate: 0xffffff,
  cache: RUN_COLORS.cacheTrim,
};

/** Color de la explosión de los barriles (engine/systems/modes.ts). */
const BARREL_BOOM = 0xff7a2a;

/** Tira de cada explosión según quién la pone (el motor solo deja su color), o null para el círculo. */
function boomStrip(b: Boom): string | null {
  const C = FX.colors;
  if (b.r > FX_ART.boom.maxR)
    return b.color === C.grenade ? 'big_blast' : b.color === C.freeze ? 'ice_blast' : null;
  if (b.color === C.debris) return 'debris';
  if (b.color === C.bloater) return 'acid_splash';
  if (b.color === C.hammer) return 'slam';
  if (b.color === C.tele || b.color === C.mine || b.color === C.grenade || b.color === BARREL_BOOM)
    return 'fire_blast';
  return null;
}

/** Sombra de los voladores y objetos del suelo (chatarra, recogibles, cofres). */
export function drawGroundItems(fx: FxLayer, w: World): void {
  const g = fx.ground;
  const t = w.time;
  // Sombra de los voladores.
  for (let i = 0; i < w.enemies.count; i++) {
    const e = w.enemies.items[i]!;
    if (e.flying) groundCircle(g, e.x, e.y, e.r * 0.8).fill({ color: RUN_COLORS.shadow, alpha: 0.3 });
  }
  // Chatarra y objetos del suelo.
  for (let i = 0; i < w.pickups.count; i++) {
    const k = w.pickups.items[i]!;
    const sx = isoX(k.x, k.y);
    const sy = isoY(k.x, k.y);
    const name = k.kind === 'gem' ? (k.val >= 25 ? 'gem25' : k.val >= 5 ? 'gem5' : 'gem1') : k.kind;
    if (fx.art?.has(name)) {
      // Con dibujo: sombra y, en los recogibles de efecto y los cofres, el halo que late para verlos de lejos.
      groundCircle(g, k.x, k.y, k.r * 1.1).fill({ color: 0x000000, alpha: 0.3 });
      const halo = PICKUP_HALO[k.kind];
      if (halo !== undefined)
        groundCircle(g, k.x, k.y, k.r * 2).fill({ color: halo, alpha: 0.14 + 0.08 * Math.sin(t * 5) });
      continue;
    }
    if (k.kind === 'gem') {
      const r = k.r;
      const c = k.val >= 25 ? RUN_COLORS.gem[25]! : k.val >= 5 ? RUN_COLORS.gem[5]! : RUN_COLORS.gem[1]!;
      g.poly([sx, sy - r * 1.4, sx + r, sy, sx, sy + r * 1.4, sx - r, sy]).fill({ color: c });
    } else if (k.kind === 'stim') {
      g.rect(sx - 4, sy - 8, 8, 12)
        .fill({ color: RUN_COLORS.stim })
        .stroke({ width: 1, color: 0xffffff });
    } else if (k.kind === 'coupon') {
      // Cupón de racionamiento: papel crema con una franja roja, ligeramente ladeado.
      const r = k.r;
      const y = sy - r - 2 + Math.sin(t * 4 + k.x) * 1.5;
      g.poly([
        sx - r * 1.3,
        y - r * 0.5,
        sx + r * 1.1,
        y - r * 0.8,
        sx + r * 1.3,
        y + r * 0.5,
        sx - r * 1.1,
        y + r * 0.8,
      ])
        .fill({ color: RUN_COLORS.coupon })
        .stroke({ width: 1, color: 0x000000, alpha: 0.6 });
      g.rect(sx - r * 0.25, y - r * 0.6, r * 0.5, r * 1.2).fill({ color: RUN_COLORS.couponInk });
    } else if (k.kind === 'cache') {
      // Cofre especial: grande, turquesa con herrajes dorados, con un halo que late para verlo de lejos.
      const r = k.r;
      const bob = Math.sin(t * 3) * 2;
      groundCircle(g, k.x, k.y, r * 2.2).fill({
        color: RUN_COLORS.cacheTrim,
        alpha: 0.15 + 0.1 * Math.sin(t * 5),
      });
      const top = sy - r * 1.5 + bob;
      g.rect(sx - r * 1.2, top, r * 2.4, r * 1.5)
        .fill({ color: RUN_COLORS.cache })
        .stroke({ width: 2, color: 0x000000, alpha: 0.7 });
      g.rect(sx - r * 1.2, top + r * 0.45, r * 2.4, r * 0.18).fill({ color: RUN_COLORS.cacheTrim });
      g.rect(sx - r * 0.2, top + r * 0.3, r * 0.4, r * 0.5).fill({ color: RUN_COLORS.cacheTrim });
    } else if (k.kind === 'freeze' || k.kind === 'nuka') {
      const bob = Math.sin(t * 4) * 2;
      const r = k.r;
      const y = sy - r + bob;
      const c = k.kind === 'freeze' ? RUN_COLORS.freeze : RUN_COLORS.nuka;
      groundCircle(g, k.x, k.y, r * 1.6).fill({ color: c, alpha: 0.18 + 0.1 * Math.sin(t * 6) });
      if (k.kind === 'freeze') {
        // Granada de cristal escarchado con su anilla.
        g.roundRect(sx - r * 0.7, y - r, r * 1.4, r * 2, r * 0.5)
          .fill({ color: RUN_COLORS.freeze })
          .stroke({ width: 1.5, color: 0x000000, alpha: 0.6 });
        g.rect(sx - r * 0.25, y - r * 0.6, r * 0.5, r * 1.2).fill({
          color: RUN_COLORS.freezeCore,
          alpha: 0.8,
        });
        g.circle(sx + r * 0.5, y - r * 1.15, r * 0.3).stroke({ width: 1.5, color: 0xc8ccd0 });
      } else {
        // Pila con el borne brillante.
        g.rect(sx - r * 0.6, y - r * 0.9, r * 1.2, r * 1.9)
          .fill({ color: RUN_COLORS.nuka })
          .stroke({ width: 1.5, color: 0x000000, alpha: 0.6 });
        g.rect(sx - r * 0.25, y - r * 1.2, r * 0.5, r * 0.3).fill({ color: 0xc8ccd0 });
        g.rect(sx - r * 0.6, y - r * 0.1, r * 1.2, r * 0.3).fill({
          color: RUN_COLORS.nukaGlow,
          alpha: 0.6 + 0.4 * Math.sin(t * 10),
        });
      }
    } else if (k.kind === 'medkit' || k.kind === 'magnet' || k.kind === 'bomb') {
      // Placeholders hasta tener sprites: flotan y laten un poco para que se vean entre la chatarra.
      const bob = Math.sin(t * 4) * 2;
      const r = k.r;
      const y = sy - r + bob;
      groundCircle(g, k.x, k.y, r * 1.6).fill({ color: 0xffffff, alpha: 0.12 + 0.08 * Math.sin(t * 6) });
      if (k.kind === 'medkit') {
        g.rect(sx - r, y - r * 0.8, r * 2, r * 1.6)
          .fill({ color: RUN_COLORS.medkit })
          .stroke({ width: 1.5, color: 0x000000, alpha: 0.6 });
        g.rect(sx - r * 0.2, y - r * 0.6, r * 0.4, r * 1.2).fill({ color: RUN_COLORS.medkitCross });
        g.rect(sx - r * 0.6, y - r * 0.2, r * 1.2, r * 0.4).fill({ color: RUN_COLORS.medkitCross });
      } else if (k.kind === 'magnet') {
        g.moveTo(sx - r * 0.85, y)
          .arc(sx, y, r * 0.85, Math.PI, 0)
          .stroke({ width: r * 0.6, color: RUN_COLORS.magnet })
          .rect(sx - r * 1.15, y, r * 0.6, r * 0.8)
          .rect(sx + r * 0.55, y, r * 0.6, r * 0.8)
          .fill({ color: RUN_COLORS.magnet });
        g.rect(sx - r * 1.15, y + r * 0.8, r * 0.6, r * 0.4)
          .rect(sx + r * 0.55, y + r * 0.8, r * 0.6, r * 0.4)
          .fill({ color: RUN_COLORS.magnetTip });
      } else {
        g.circle(sx, y + r * 0.2, r)
          .fill({ color: RUN_COLORS.bomb })
          .stroke({ width: 1.5, color: 0xffffff, alpha: 0.4 });
        g.moveTo(sx + r * 0.5, y - r * 0.6)
          .lineTo(sx + r * 0.9, y - r * 1.2)
          .stroke({ width: 2, color: 0x8a7a5a });
        g.circle(sx + r * 0.9, y - r * 1.25, 2 + Math.abs(Math.sin(t * 12)) * 1.5).fill({
          color: RUN_COLORS.bombFuse,
        });
      }
    } else {
      const bob = Math.sin(t * 3) * 2;
      const c = k.kind === 'chest' ? RUN_COLORS.chest : RUN_COLORS.crate;
      g.rect(sx - k.r, sy - k.r * 1.2 + bob, k.r * 2, k.r * 1.2)
        .fill({ color: c })
        .stroke({ width: 2, color: 0x000000, alpha: 0.6 });
    }
  }
}

/** Explosiones, golpes de martillo y salpicaduras. */
export function drawBooms(fx: FxLayer, w: World): void {
  const g = fx.ground;
  const sg = fx.sg;
  const sa = fx.sa;
  const B = FX_ART.boom;
  for (let i = 0; i < w.booms.count; i++) {
    const b = w.booms.items[i]!;
    const f = b.life / b.max;
    const strip = boomStrip(b);
    if (strip && sa?.has(strip)) {
      // El golpe del martillo es una onda en el suelo; las explosiones y el ácido saltan por encima de los actores.
      const o =
        strip === 'slam'
          ? B.slam
          : strip === 'acid_splash'
            ? B.acid
            : strip === 'debris'
              ? B.debris
              : strip === 'fire_blast'
                ? B.fire
                : strip === 'ice_blast'
                  ? B.ice
                  : B.big;
      const layer = strip === 'slam' ? sg! : sa;
      layer.put(strip, layer.once(strip, 1 - f), isoX(b.x, b.y), isoY(b.x, b.y), b.r * o.r, {
        ay: o.ay,
        alpha: 'alpha' in o ? o.alpha * Math.min(1, f / o.fade) : 1,
        flip: (i & 1) === 1,
      });
      continue;
    }
    groundCircle(g, b.x, b.y, b.r * (1.1 - 0.3 * f)).fill({ color: b.color, alpha: 0.45 * f });
  }
}
