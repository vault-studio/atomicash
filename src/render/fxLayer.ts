// Placeholders de proyectiles, chatarra, charcos, explosiones y rayos (04_ART_UI.md §5).
// Dos Graphics que se redibujan cada frame: suelo (bajo los actores) y aire (encima). Los efectos con dibujo
// (`FX_ART`) van en dos capas de sprites encima de cada Graphics; sin su tira, queda el placeholder.
import { Container, Graphics, Text, type TextStyleOptions } from 'pixi.js';
import { FX_ART, RUN_COLORS } from '../config/render';
import { FX, JUICE } from '../config/run';
import { WEAPONS } from '../config/weapons';
import { ELITES, ENEMY_RULES } from '../config/enemies';
import type { Boom, World } from '../engine/types';
import type { FxSprites } from './fxSprites';
import { isoX, isoY } from './iso';
import type { PickupArt } from './pickupLayer';

const TAU = Math.PI * 2;
const SQ = Math.SQRT1_2;

/** Círculo del suelo (radio r en mundo) como elipse isométrica. */
function groundCircle(g: Graphics, x: number, y: number, r: number): Graphics {
  return g.ellipse(isoX(x, y), isoY(x, y), r, r / 2);
}

/** Rectángulo del suelo de (x, y) a (x + lx, y + ly) con semiancho (nx, ny), en isométrica. */
function groundQuad(
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
  if (b.r > FX_ART.boom.maxR) return null;
  const C = FX.colors;
  if (b.color === C.bloater) return 'acid_splash';
  if (b.color === C.hammer) return 'slam';
  if (b.color === C.tele || b.color === C.mine || b.color === C.grenade || b.color === BARREL_BOOM)
    return 'fire_blast';
  return null;
}

/** Ángulo en pantalla de una dirección de mundo. */
const screenAngle = (vx: number, vy: number): number => Math.atan2(isoY(vx, vy), isoX(vx, vy));

export class FxLayer {
  readonly ground = new Graphics();
  readonly air = new Graphics();
  /** Dibujos de los objetos del mapa: los que tienen dibujo solo llevan aquí su sombra o su halo. */
  art: PickupArt | null = null;
  /** Sprites de efectos bajo los actores (charcos, zona, avisos) y encima (proyectiles, explosiones, estados). */
  sg: FxSprites | null = null;
  sa: FxSprites | null = null;
  /** Subida de nivel y curación que se están mostrando: momento en que empezaron (−1 = nada). */
  private levelSeen = -1;
  private levelAt = -1;
  private hpSeen = -1;
  private healAt = -1;

  /**
   * Lo que cae en una lluvia, cada vez más deprisa (`f` de 0 a 1). PLACEHOLDER: un trozo de chapa que gira o una gota,
   * hasta que haya dibujo propio.
   */
  private drawFall(a: Graphics, x: number, y: number, kind: 'scrap' | 'acid', f: number, t: number): void {
    const F = RUN_COLORS.falling;
    if (f < F.from) return;
    const sx = isoX(x, y);
    const sy = isoY(x, y) - F.height * (1 - f * f);
    const c = F[kind];
    const s = c.size;
    if (kind === 'acid') {
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

  draw(w: World): void {
    const g = this.ground;
    const a = this.air;
    g.clear();
    a.clear();
    const t = w.time;
    const sg = this.sg;
    const sa = this.sa;
    sg?.begin();
    sa?.begin();
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
      const tint = tl.fall === 'acid' ? RUN_COLORS.hazard : RUN_COLORS.tele;
      if (tl.fall === 'scrap' || tl.fall === 'acid') this.drawFall(a, tl.x, tl.y, tl.fall, f, t);
      if (tl.lx !== 0 || tl.ly !== 0) {
        this.drawLane(g, tl.x, tl.y, tl.lx, tl.ly, tl.r, f, blink, t);
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
    const barrelArt = this.art?.has('barrel') ?? false;
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
      if (this.art?.has('mine') || m.fly > 0) continue;
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
        const pulse = 0.5 + 0.5 * Math.sin(t * 6);
        groundCircle(g, p.x, p.y, wp.r)
          .fill({ color: WEAPONS[wp.id].color, alpha: 0.06 + 0.04 * pulse })
          .stroke({ width: 1.5, color: WEAPONS[wp.id].color, alpha: 0.35 });
      }
    }
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
      if (this.art?.has(name)) {
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
    const B = FX_ART.boom;
    for (let i = 0; i < w.booms.count; i++) {
      const b = w.booms.items[i]!;
      const f = b.life / b.max;
      const strip = boomStrip(b);
      if (strip && sa?.has(strip)) {
        // El golpe del martillo es una onda en el suelo; las explosiones y el ácido saltan por encima de los actores.
        const o = strip === 'slam' ? B.slam : strip === 'acid_splash' ? B.acid : B.fire;
        const layer = strip === 'slam' ? sg! : sa;
        layer.put(strip, layer.once(strip, 1 - f), isoX(b.x, b.y), isoY(b.x, b.y), b.r * o.r, {
          ay: o.ay,
          flip: (i & 1) === 1,
        });
        continue;
      }
      groundCircle(g, b.x, b.y, b.r * (1.1 - 0.3 * f)).fill({ color: b.color, alpha: 0.45 * f });
    }
    this.drawEnemyFx(w);
    this.drawPlayerFx(w);

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
        .fill({ color: RUN_COLORS.ebullet })
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
    sg?.end();
    sa?.end();
  }

  /**
   * Pasillo de embestida de (x, y) a (x + lx, y + ly), semiancho r: franja de tierra levantada que se difumina hacia
   * los lados, un brillo rojo que avanza con la carga (f de 0 a 1) y galones que marchan hacia donde irá.
   */
  private drawLane(
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

  /**
   * Efectos sobre los enemigos: polvo al aparecer, hielo al estar congelados (se rompe al descongelarse), estrellas
   * al estar aturdidos y llamas al pisar un charco de fuego; y la mancha del suelo de los recién muertos.
   */
  private drawEnemyFx(w: World): void {
    const sg = this.sg;
    const sa = this.sa;
    if (!sg || !sa) return;
    const E = FX_ART.enemy;
    const t = w.time;
    for (let i = 0; i < w.enemies.count; i++) {
      const e = w.enemies.items[i]!;
      if (e.dead) continue;
      const sx = isoX(e.x, e.y);
      const sy = isoY(e.x, e.y);
      const up = e.flying ? FLY_HEIGHT : 0;
      const age = t - e.born;
      if (age < E.spawn.dur && !e.flying)
        sg.put('spawn', sg.once('spawn', age / E.spawn.dur), sx, sy, e.r * E.spawn.r, { ay: E.spawn.ay });
      if (e.frozen > 0) {
        // Los últimos `thaw` s se rompe el hielo (frames 1…).
        const n = sa.art.get('ice')?.frames.length ?? 1;
        const frame =
          e.frozen > E.ice.thaw ? 0 : Math.min(n - 1, 1 + Math.floor((1 - e.frozen / E.ice.thaw) * (n - 1)));
        sa.put('ice', frame, sx, sy - up, e.r * E.ice.r, { ay: E.ice.ay });
      } else if (e.stun > 0 && !e.boss) {
        sa.put(
          'stun',
          sa.loop('stun', t + i * 0.1, E.stun.fps),
          sx,
          sy - up - e.r * E.stun.head,
          e.r * E.stun.r,
        );
      }
      if (!e.flying) {
        // Arde si lleva quemaduras del cóctel o si pisa un charco (los de los dardos no dejan quemadura).
        let burning = 0;
        for (let s = 0; s < e.burnT.length; s++) if (e.burnT[s]! > 0) burning++;
        if (burning > 0)
          sa.put(
            'burn',
            sa.loop('burn', t + i * 0.17, E.burn.fps),
            sx,
            sy,
            e.r * E.burn.r * (0.8 + 0.15 * burning),
            {
              ay: E.burn.ay,
              alpha: 0.9,
            },
          );
        else
          for (let j = 0; j < w.pools.count; j++) {
            const pl = w.pools.items[j]!;
            if ((e.x - pl.x) ** 2 + (e.y - pl.y) ** 2 < pl.r * pl.r) {
              sa.put('burn', sa.loop('burn', t + i * 0.17, E.burn.fps), sx, sy, e.r * E.burn.r, {
                ay: E.burn.ay,
                alpha: 0.9,
              });
              break;
            }
          }
      }
    }
    const D = FX_ART.death;
    for (let i = 0; i < w.corpses.count; i++) {
      const c = w.corpses.items[i]!;
      const age = t - c.t;
      if (age >= D.dur || c.flying) continue;
      sg.put('death', sg.once('death', age / D.dur), isoX(c.x, c.y), isoY(c.x, c.y), D.w, {
        ay: D.ay,
        flip: (i & 1) === 1,
      });
    }
  }

  /** Columna de luz al subir de nivel y cruces verdes al curarse de golpe (botiquín, rasgos). */
  private drawPlayerFx(w: World): void {
    const sa = this.sa;
    const p = w.player;
    const t = w.time;
    // Primera vez (o partida nueva): solo apunta, no celebra.
    if (this.levelSeen < 0 || w.level < this.levelSeen) {
      this.levelSeen = w.level;
      this.hpSeen = p.hp;
      this.levelAt = this.healAt = -1;
    }
    if (w.level > this.levelSeen) this.levelAt = t;
    this.levelSeen = w.level;
    const H = FX_ART.heal;
    if (p.hp - this.hpSeen >= p.maxHp * H.minFrac) this.healAt = t;
    this.hpSeen = p.hp;
    if (!sa) return;
    const sx = isoX(p.x, p.y);
    const sy = isoY(p.x, p.y);
    // Aturdido por un interceptor: las mismas estrellas que los enemigos.
    if (p.stun > 0) {
      const E = FX_ART.enemy.stun;
      sa.put('stun', sa.loop('stun', t, E.fps), sx, sy - p.r * E.head, p.r * E.r);
    }
    const L = FX_ART.levelup;
    if (this.levelAt >= 0 && t - this.levelAt < L.dur)
      sa.put('levelup', sa.once('levelup', (t - this.levelAt) / L.dur), sx, sy, L.w, { ay: L.ay, add: true });
    if (this.healAt >= 0 && t - this.healAt < H.dur)
      sa.put('heal', sa.once('heal', (t - this.healAt) / H.dur), sx, sy, H.w, { ay: H.ay, add: true });
  }
}

const TEXT_STYLE: TextStyleOptions = {
  fontFamily: '"Pixelify Sans", monospace',
  fontSize: 14,
  fontWeight: '700',
  fill: 0xffffff,
  stroke: { color: 0x000000, width: 3 },
};

/** Textos flotantes reutilizados (daño, críticos, recogidas, eslóganes). */
export class TextLayer extends Container {
  private readonly pool: Text[] = [];
  /** Tipo con el que se estilizó cada texto (cambiar el estilo regenera la textura). */
  private readonly kinds: string[] = [];

  constructor(private readonly translate: (key: string) => string) {
    super();
  }

  draw(w: World, showDmg: boolean): void {
    const n = w.texts.count;
    let used = 0;
    for (let i = 0; i < n; i++) {
      const ft = w.texts.items[i]!;
      if (ft.kind === 'dmg' && !showDmg) continue;
      let tx = this.pool[used];
      if (!tx) {
        tx = new Text({ text: '', style: TEXT_STYLE });
        tx.anchor.set(0.5, 1);
        this.pool.push(tx);
        this.addChild(tx);
      }
      used++;
      let s: string;
      switch (ft.kind) {
        case 'dmg':
          s = String(ft.value);
          break;
        case 'crit':
          s = `${ft.value}!`;
          break;
        case 'hurt':
          s = `-${ft.value}`;
          break;
        case 'dodge':
          s = this.translate('run.dodge');
          break;
        case 'pickup':
          s = ft.value ? `+${ft.value} ${this.translate(ft.key)}` : `+${this.translate(ft.key)}`;
          break;
        case 'slogan':
          s = this.translate(`slogans.${ft.value}`);
          break;
      }
      if (tx.text !== s) tx.text = s;
      if (this.kinds[used - 1] !== ft.kind) {
        this.kinds[used - 1] = ft.kind;
        tx.style.fill = RUN_COLORS.text[ft.kind];
        tx.style.fontSize = ft.kind === 'crit' ? 24 : ft.kind === 'dmg' ? 10 : 13;
      }
      const age = FX.textLife - ft.life;
      const rise = (age / FX.textLife) * 30;
      tx.position.set(isoX(ft.x, ft.y), isoY(ft.x, ft.y) - 40 - rise);
      // Más grande cuanto más daño, y un rebote al aparecer.
      const D = JUICE.dmgScale;
      let k = 1;
      if (ft.kind === 'dmg' || ft.kind === 'crit')
        k = Math.min(D.max, D.base + D.perDigit * Math.log10(Math.max(1, ft.value)));
      if (age < D.popTime) k *= 1 + D.pop * (1 - age / D.popTime);
      tx.scale.set(k);
      tx.alpha = Math.min(1, ft.life * 3);
      tx.visible = true;
    }
    for (let i = used; i < this.pool.length; i++) this.pool[i]!.visible = false;
  }
}

export const FLY_HEIGHT = ENEMY_RULES.flyHeight;
