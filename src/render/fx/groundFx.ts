// Charcos, avisos en el suelo (con lo que cae del cielo) y pasillos de embestida.
import { Graphics } from 'pixi.js';
import { FX_ART, RUN_COLORS } from '../../config/render';
import { RUN } from '../../config/run';
import type { TeleFall, World } from '../../engine/types';
import { isoX, isoY } from '../iso';
import type { FxLayer } from './fxLayer';
import { groundCircle, groundQuad } from './shapes';

/** Lo que cae del cielo, cada vez más deprisa (`f` de 0 a 1). Sin su tira, un trozo de chapa que gira o una gota. */
function drawFall(
  fx: FxLayer,
  a: Graphics,
  x: number,
  y: number,
  kind: TeleFall,
  f: number,
  t: number,
): void {
  const F = RUN_COLORS.falling;
  if (f < F.from) return;
  const sx = isoX(x, y);
  const sy = isoY(x, y) - F.height * (1 - f * f);
  const sa = fx.sa;
  const art = FX_ART.fall[kind];
  if (sa?.has(art.strip)) {
    if (art === FX_ART.fall.scrap) {
      const piece = Math.abs(Math.floor((x + y) / RUN.groundCell));
      sa.put(art.strip, piece % sa.frames(art.strip), sx, sy, art.w, { ay: art.ay, rot: t * art.spin + x });
    } else if ('fps' in art)
      sa.put(art.strip, sa.loop(art.strip, t, art.fps), sx, sy, art.w, {
        ay: art.ay,
        tint: 'tint' in art ? art.tint : undefined,
      });
    return;
  }
  if (kind === 'shell' || kind === 'ice') return;
  const c = kind === 'scrap' ? F.scrap : F.acid;
  const s = c.size;
  if (kind !== 'scrap') {
    a.moveTo(sx, sy - s * 1.9)
      .bezierCurveTo(sx + s, sy - s * 0.6, sx + s, sy + s, sx, sy + s)
      .bezierCurveTo(sx - s, sy + s, sx - s, sy - s * 0.6, sx, sy - s * 1.9)
      .fill({ color: c.color, alpha: 0.9 })
      .stroke({ width: 2, color: c.edge });
    return;
  }
  const r = t * 9 + x;
  a.poly(
    [0, 0.45, 1.6, 2.2, 3.3, 4.6].flatMap((o, k) => {
      const d = s * (k % 2 === 0 ? 1 : 0.65);
      return [sx + Math.cos(r + o) * d, sy + Math.sin(r + o) * d * 0.7];
    }),
  )
    .fill({ color: c.color })
    .stroke({ width: 2, color: c.edge });
}
/**
 * Pasillo de embestida de (x, y) a (x + lx, y + ly), semiancho r: franja de tierra levantada que se difumina hacia
 * los lados, un brillo rojo que avanza con la carga (f de 0 a 1) y galones que marchan hacia donde irá.
 */
function drawLane(
  g: Graphics,
  x: number,
  y: number,
  lx: number,
  ly: number,
  r: number,
  f: number,
  blink: number,
  t: number,
): void {
  const L = FX_ART.lane;
  const len = Math.sqrt(lx * lx + ly * ly);
  const ux = lx / len;
  const uy = ly / len;
  const nx = -uy * r;
  const ny = ux * r;
  for (const b of L.bands)
    groundQuad(g, x, y, lx, ly, nx * b.w, ny * b.w).fill({ color: L.dust, alpha: b.a });
  if (f > 0)
    groundQuad(g, x, y, lx * f, ly * f, nx * L.glow.w, ny * L.glow.w).fill({
      color: RUN_COLORS.tele,
      alpha: L.glow.a * blink,
    });
  const C = L.chevron;
  const hl = r * C.len;
  const reach = len * f;
  // Los galones nacen y mueren suaves en los extremos para que no aparezcan de golpe.
  for (let s = r * 0.5 + ((t * C.speed) % C.gap); s < len - hl; s += C.gap) {
    const edge = Math.min(1, (s - r * 0.5) / C.gap, (len - hl - s) / C.gap);
    const cx = x + ux * s;
    const cy = y + uy * s;
    const tx = cx + ux * hl;
    const ty = cy + uy * hl;
    const bx = cx - ux * hl;
    const by = cy - uy * hl;
    g.moveTo(isoX(bx + nx * C.wing, by + ny * C.wing), isoY(bx + nx * C.wing, by + ny * C.wing))
      .lineTo(isoX(tx, ty), isoY(tx, ty))
      .lineTo(isoX(bx - nx * C.wing, by - ny * C.wing), isoY(bx - nx * C.wing, by - ny * C.wing))
      .stroke({
        width: C.width,
        color: RUN_COLORS.tele,
        alpha: (s <= reach ? C.lit * blink : C.dim) * edge,
        cap: 'round',
        join: 'round',
      });
  }
}
/** Charcos de ácido y de fuego y avisos en el suelo (con lo que cae del cielo). */
export function drawPools(fx: FxLayer, w: World): void {
  const g = fx.ground;
  const a = fx.air;
  const t = w.time;
  const sg = fx.sg;
  const P = FX_ART.pool;

  const acidArt = sg?.has('acid_pool') ?? false;
  for (let i = 0; i < w.slimes.count; i++) {
    const s = w.slimes.items[i]!;
    // Duran un minuto: se dibujan solo los cercanos y se apagan al final, no a lo largo de toda su vida.
    if ((s.x - w.player.x) ** 2 + (s.y - w.player.y) ** 2 > P.acid.cull ** 2) continue;
    const fade = Math.min(1, s.life / P.acid.fade);
    if (acidArt) {
      // Cada charco en su fase para que no burbujeen todos a la vez.
      sg!.put(
        'acid_pool',
        sg!.loop('acid_pool', t + i * 0.37, P.acid.fps),
        isoX(s.x, s.y),
        isoY(s.x, s.y),
        s.r * P.acid.r,
        {
          ay: P.acid.ay,
          alpha: fade * 0.85,
        },
      );
      continue;
    }
    groundCircle(g, s.x, s.y, s.r).fill({ color: RUN_COLORS.slime, alpha: 0.25 * fade });
  }
  const fireArt = sg?.has('fire_pool') ?? false;
  for (let i = 0; i < w.pools.count; i++) {
    const pl = w.pools.items[i]!;
    const fade = Math.min(1, pl.life / 0.5);
    if (fireArt) {
      sg!.put(
        'fire_pool',
        sg!.loop('fire_pool', t + i * 0.29, P.fire.fps),
        isoX(pl.x, pl.y),
        isoY(pl.x, pl.y),
        pl.r * P.fire.r,
        {
          ay: P.fire.ay,
          alpha: fade,
        },
      );
      continue;
    }
    const c = pl.src === 'coctel' ? RUN_COLORS.pool : 0xff9f5a;
    groundCircle(g, pl.x, pl.y, pl.r).fill({ color: c, alpha: 0.35 * fade });
  }
  for (let i = 0; i < w.tele.count; i++) {
    const tl = w.tele.items[i]!;
    const f = tl.t / tl.dur;
    // El último cuarto parpadea: ya va a caer.
    const blink = f > 0.75 ? 0.5 + 0.5 * Math.sin(t * 40) : 1;
    const tint = tl.fall === 'acid' || tl.fall === 'barrel' ? RUN_COLORS.hazard : RUN_COLORS.tele;
    if (tl.fall) drawFall(fx, a, tl.x, tl.y, tl.fall, f, t);
    if (tl.lx !== 0 || tl.ly !== 0) {
      drawLane(g, tl.x, tl.y, tl.lx, tl.ly, tl.r, f, blink, t);
      continue;
    }
    if (sg?.has('tele_circle')) {
      // Disco con franjas que crece desde el centro y aro discontinuo con flechas hacia dentro.
      const T = FX_ART.tele;
      const sx = isoX(tl.x, tl.y);
      const sy = isoY(tl.x, tl.y);
      if (f > 0)
        sg.put('tele_disc', 0, sx, sy, tl.r * f * T.disc.r, {
          flat: true,
          tint,
          alpha: T.disc.alpha * blink,
        });
      sg.put('tele_circle', 0, sx, sy, tl.r * T.circle.r, {
        flat: true,
        tint,
        alpha: 0.9 * blink,
      });
      continue;
    }
    groundCircle(g, tl.x, tl.y, tl.r).stroke({ width: 2, color: tint, alpha: 0.8 * blink });
    groundCircle(g, tl.x, tl.y, tl.r * f).fill({ color: tint, alpha: 0.25 * blink });
  }
}
