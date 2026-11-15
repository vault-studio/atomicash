// Zona del objetivo, barriles, bomba del espejo y auras (élites, petardos, jugador y armas).
import { FX_ART, RUN_COLORS } from '../../config/render';
import { WEAPONS } from '../../config/weapons';
import { ELITES } from '../../config/enemies';
import { MIRROR } from '../../config/modes';
import type { World } from '../../engine/types';
import { isoX, isoY } from '../iso';
import type { FxLayer } from './fxLayer';
import { groundCircle } from './shapes';

/** Zona del objetivo, barriles explosivos y bomba del evento espejo. */
export function drawZones(fx: FxLayer, w: World): void {
  const g = fx.ground;
  const t = w.time;
  const sg = fx.sg;
  // Zona del objetivo: anillo que late y se llena con el progreso (amarillo «aguanta», rojo «limpia la zona»).
  const ob = w.objective;
  if (ob) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 4);
    const f = Math.min(1, ob.progress / ob.goal);
    if (sg?.has('zone_ring')) {
      const Z = FX_ART.zone;
      const col = ob.kind === 'purge' ? Z.purge : RUN_COLORS.objective;
      const sx = isoX(ob.x, ob.y);
      const sy = isoY(ob.x, ob.y);
      const pl = w.player;
      const inside = (pl.x - ob.x) ** 2 + (pl.y - ob.y) ** 2 < ob.r * ob.r;
      if (f > 0) groundCircle(g, ob.x, ob.y, ob.r * f).fill({ color: col, alpha: 0.16 });
      // Dentro: el suelo brilla y suben chispas del borde. Fuera: un brillo tenue para ver la zona de lejos.
      const glow = inside ? sg.loop('zone_glow', t, Z.glow.fps) : 0;
      sg.put('zone_glow', glow, sx, sy, ob.r * Z.glow.r, {
        flat: true,
        tint: col,
        add: true,
        alpha: inside ? Z.glow.alpha : 0.12 + 0.08 * pulse,
      });
      if (inside)
        sg.put('zone_motes', sg.loop('zone_motes', t, Z.motes.fps), sx, sy, ob.r * Z.motes.r, {
          ay: Z.motes.ay,
          tint: col,
          add: true,
          alpha: Z.motes.alpha,
        });
      sg.put('zone_ring', 0, sx, sy, ob.r * Z.ring.r, {
        flat: true,
        tint: col,
        alpha: 0.75 + 0.25 * pulse,
      });
    } else {
      groundCircle(g, ob.x, ob.y, ob.r)
        .fill({ color: RUN_COLORS.objective, alpha: 0.06 + 0.05 * pulse })
        .stroke({ width: 3, color: RUN_COLORS.objective, alpha: 0.6 + 0.3 * pulse });
      if (f > 0) groundCircle(g, ob.x, ob.y, ob.r * f).fill({ color: RUN_COLORS.objective, alpha: 0.18 });
    }
  }
  // Barriles explosivos: rojos con la franja amarilla; con la mecha encendida parpadean.
  const barrelArt = fx.art?.has('barrel') ?? false;
  for (let i = 0; i < w.barrels.count; i++) {
    const b = w.barrels.items[i]!;
    const sx = isoX(b.x, b.y);
    const sy = isoY(b.x, b.y);
    const r = b.r;
    const lit = b.fuse >= 0 && Math.sin(t * 60) > 0;
    groundCircle(g, b.x, b.y, r).fill({ color: 0x000000, alpha: 0.35 });
    if (barrelArt) {
      // Mecha encendida: destello rojo en el suelo.
      if (lit) groundCircle(g, b.x, b.y, r * 2).fill({ color: RUN_COLORS.barrel, alpha: 0.35 });
      continue;
    }
    g.rect(sx - r * 0.8, sy - r * 2.2, r * 1.6, r * 2.2)
      .fill({ color: lit ? 0xffffff : RUN_COLORS.barrel })
      .stroke({ width: 1.5, color: 0x000000, alpha: 0.7 });
    g.rect(sx - r * 0.8, sy - r * 1.35, r * 1.6, r * 0.4).fill({ color: RUN_COLORS.barrelBand });
    g.ellipse(sx, sy - r * 2.2, r * 0.8, r * 0.3).fill({ color: 0x5a1a10 });
  }
  // Bomba del evento «Tú mismo, otra vez» (sin arte): esfera oscura con un aro rojo que late, distinta del pickup `bomb`.
  const mb = w.mirror;
  if (mb.phase === 1) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 7);
    const r = MIRROR.r;
    const sx = isoX(mb.x, mb.y);
    const sy = isoY(mb.x, mb.y);
    groundCircle(g, mb.x, mb.y, r * (1.2 + 0.5 * pulse))
      .fill({ color: RUN_COLORS.mirrorPulse, alpha: 0.12 + 0.12 * pulse })
      .stroke({ width: 2.5, color: RUN_COLORS.mirrorPulse, alpha: 0.5 + 0.4 * pulse });
    groundCircle(g, mb.x, mb.y, r * 0.6).fill({ color: 0x000000, alpha: 0.4 });
    g.circle(sx, sy - r * 0.55, r * 0.55)
      .fill({ color: RUN_COLORS.mirrorBomb })
      .stroke({ width: 2, color: RUN_COLORS.mirrorPulse, alpha: 0.6 + 0.4 * pulse });
    g.circle(sx, sy - r * 0.55, r * 0.2).fill({ color: RUN_COLORS.mirrorPulse, alpha: 0.5 + 0.5 * pulse });
  }
}

/** Auras de élites, petardos en el suelo y auras del jugador y de sus armas. */
export function drawAuras(fx: FxLayer, w: World): void {
  const g = fx.ground;
  const t = w.time;
  const sg = fx.sg;
  // Aura de los élites: anillo del color de su prefijo que late (la del radiactivo marca su alcance).
  for (let i = 0; i < w.enemies.count; i++) {
    const e = w.enemies.items[i]!;
    if (!e.elite || e.dead) continue;
    const E = ELITES[e.elite];
    const pulse = 0.5 + 0.5 * Math.sin(t * 6 + e.id);
    const r = e.elite === 'radiactivo' ? ELITES.radiactivo.auraR : e.r * 1.9;
    groundCircle(g, e.x, e.y, r)
      .fill({ color: E.color, alpha: 0.1 + 0.08 * pulse })
      .stroke({ width: 2.5, color: E.color, alpha: 0.55 + 0.35 * pulse });
  }
  for (let i = 0; i < w.mines.count; i++) {
    const m = w.mines.items[i]!;
    // Sombra del petardo en vuelo o en el suelo; sin dibujo, también su cuerpo cuando ya ha caído.
    const f = m.fly > 0 ? 1 - m.fly / m.flyDur : 1;
    groundCircle(g, m.sx + (m.x - m.sx) * f, m.sy + (m.y - m.sy) * f, 5).fill({
      color: 0x000000,
      alpha: 0.3,
    });
    if (fx.art?.has('mine') || m.fly > 0) continue;
    const sx = isoX(m.x, m.y);
    const sy = isoY(m.x, m.y);
    g.rect(sx - 3, sy - 5, 6, 8).fill({ color: RUN_COLORS.mine });
  }
  // Auras del jugador.
  const p = w.player;
  if (p.nuka > 0) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 14);
    const fade = Math.min(1, p.nuka);
    groundCircle(g, p.x, p.y, 26 + pulse * 4).stroke({
      width: 2.5,
      color: RUN_COLORS.nuka,
      alpha: (0.5 + 0.3 * pulse) * fade,
    });
  }
  if (p.boots > 0) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 10);
    groundCircle(g, p.x, p.y, 22 + pulse * 3).stroke({
      width: 2,
      color: RUN_COLORS.boots,
      alpha: (0.45 + 0.3 * pulse) * Math.min(1, p.boots),
    });
  }
  for (const wp of w.weapons) {
    if ((wp.id === 'geiger' || wp.id === 'nucleo_inestable') && wp.r > 0) {
      const art = FX_ART.aura[wp.id];
      if (art && sg?.has(art.strip)) {
        sg.put(
          art.strip,
          sg.loop(art.strip, t, art.fps),
          isoX(p.x, p.y),
          isoY(p.x, p.y),
          (2 * wp.r) / art.ring,
          {
            ax: art.ax,
            ay: art.ay,
            alpha: art.alpha,
          },
        );
        continue;
      }
      const pulse = 0.5 + 0.5 * Math.sin(t * 6);
      groundCircle(g, p.x, p.y, wp.r)
        .fill({ color: WEAPONS[wp.id].color, alpha: 0.06 + 0.04 * pulse })
        .stroke({ width: 1.5, color: WEAPONS[wp.id].color, alpha: 0.35 });
    }
  }
}
