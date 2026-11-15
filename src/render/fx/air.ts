// Efectos en el aire: esquirlas, proyectiles, rayos, armas orbitales y cócteles.
import { FX_ART, RUN_COLORS } from '../../config/render';
import { FX } from '../../config/run';
import { WEAPONS } from '../../config/weapons';
import type { World } from '../../engine/types';
import { isoX, isoY } from '../iso';
import type { FxLayer } from './fxLayer';
import { SQ, TAU, screenAngle } from './shapes';

/** Aire: esquirlas, proyectiles, rayos, armas orbitales y cócteles en vuelo. */
export function drawAir(fx: FxLayer, w: World): void {
  const a = fx.air;
  const t = w.time;
  const sa = fx.sa;
  const p = w.player;
  // Aire: esquirlas, proyectiles, rayos, armas orbitales y cócteles en vuelo.
  const lift = 22;
  for (let i = 0; i < w.parts.count; i++) {
    const q = w.parts.items[i]!;
    const s = q.size;
    a.rect(isoX(q.x, q.y) - s / 2, isoY(q.x, q.y) - q.z - s / 2, s, s).fill({
      color: q.color,
      alpha: Math.min(1, (q.life / q.max) * 2),
    });
  }
  for (let i = 0; i < w.shots.count; i++) {
    const s = w.shots.items[i]!;
    const sx = isoX(s.x, s.y);
    const sy = isoY(s.x, s.y) - lift;
    const strip = FX_ART.shotArt[s.src];
    if (strip && sa?.has(strip)) {
      sa.put(strip, sa.loop(strip, t + i * 0.1, 12), sx, sy, FX_ART.shot[s.src]!.w, {
        ax: FX_ART.shotAx,
        rot: screenAngle(s.vx, s.vy),
      });
      continue;
    }
    a.circle(sx, sy, Math.max(2.5, s.r * 0.8)).fill({ color: WEAPONS[s.src].color });
  }
  for (let i = 0; i < w.ebullets.count; i++) {
    const b = w.ebullets.items[i]!;
    // Las radiactivas son escupitajos de ácido; las demás, balas rojas.
    const strip = b.rad > 0 ? 'acid_spit' : 'ebullet';
    if (sa?.has(strip)) {
      sa.put(
        strip,
        sa.loop(strip, t + i * 0.1, FX_ART.ebullet.fps),
        isoX(b.x, b.y),
        isoY(b.x, b.y) - lift,
        b.r * FX_ART.ebullet.r,
        {
          ax: FX_ART.shotAx,
          rot: screenAngle(b.vx, b.vy),
        },
      );
      continue;
    }
    a.circle(isoX(b.x, b.y), isoY(b.x, b.y) - lift, b.r)
      .fill({ color: b.rad > 0 ? RUN_COLORS.radBullet : RUN_COLORS.ebullet })
      .stroke({ width: 1, color: 0x000000, alpha: 0.6 });
  }
  for (let i = 0; i < w.lobs.count; i++) {
    const l = w.lobs.items[i]!;
    const f = l.t / l.dur;
    const x = l.sx + (l.tx - l.sx) * f;
    const y = l.sy + (l.ty - l.sy) * f;
    const h = Math.sin(f * Math.PI) * 60 + lift;
    if (sa?.has('molotov')) {
      const M = FX_ART.molotov;
      sa.put('molotov', sa.loop('molotov', l.t + i * 0.2, M.fps), isoX(x, y), isoY(x, y) - h, M.w);
      continue;
    }
    a.circle(isoX(x, y), isoY(x, y) - h, 4).fill({ color: WEAPONS.coctel.color });
  }
  for (let i = 0; i < w.beams.count; i++) {
    const b = w.beams.items[i]!;
    if (b.n < 2) continue;
    if (b.n === 3 && b.color === FX.colors.cone && sa?.has('wave')) {
      // Megáfono: ondas desde el jugador (punto del medio) hacia el centro del cono.
      const px = b.pts[2]!;
      const py = b.pts[3]!;
      const dx = (b.pts[0]! + b.pts[4]!) / 2 - px;
      const dy = (b.pts[1]! + b.pts[5]!) / 2 - py;
      const len = Math.hypot(isoX(dx, dy), isoY(dx, dy));
      sa.put(
        'wave',
        sa.once('wave', 1 - b.life / b.max),
        isoX(px, py),
        isoY(px, py) - lift,
        len * FX_ART.wave.len,
        {
          ax: 0,
          rot: screenAngle(dx, dy),
        },
      );
      continue;
    }
    a.moveTo(isoX(b.pts[0]!, b.pts[1]!), isoY(b.pts[0]!, b.pts[1]!) - lift);
    for (let j = 1; j < b.n; j++) {
      const x = b.pts[j * 2]!;
      const y = b.pts[j * 2 + 1]!;
      // Zigzag para que parezca eléctrico.
      a.lineTo(isoX(x, y) + Math.sin(t * 90 + j) * 3, isoY(x, y) - lift);
    }
    a.stroke({ width: 2.5, color: b.color, alpha: Math.min(1, (b.life / b.max) * 1.5) });
  }
  for (const wp of w.weapons) {
    if (wp.id !== 'llave' && wp.id !== 'dinamo') continue;
    const W = WEAPONS[wp.id];
    const n = wp.id === 'llave' ? wp.lvl : WEAPONS.dinamo.count;
    for (let i = 0; i < n; i++) {
      const an = wp.a + (i * TAU) / n;
      const x = p.x + Math.cos(an) * W.orbit;
      const y = p.y + Math.sin(an) * W.orbit;
      const sx = isoX(x, y);
      const sy = isoY(x, y) - lift;
      const s = W.size * w.st.area * SQ;
      if (wp.id === 'llave' && sa?.has('wrench')) {
        // La llave va de punta hacia donde gira, con la estela detrás.
        sa.put('wrench', 0, sx, sy, s * FX_ART.wrench.size, {
          rot: screenAngle(-Math.sin(an), Math.cos(an)),
        });
        continue;
      }
      if (wp.id === 'dinamo' && sa?.has('coil')) {
        sa.put('coil', sa.loop('coil', t + i * 0.13, FX_ART.coil.fps), sx, sy, s * FX_ART.coil.size);
        continue;
      }
      a.rect(sx - s, sy - s * 0.4, s * 2, s * 0.8)
        .fill({ color: W.color })
        .stroke({ width: 1, color: 0x000000, alpha: 0.6 });
    }
  }
}
