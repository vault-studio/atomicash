// Placeholders de proyectiles, chatarra, charcos, explosiones y rayos (04_ART_UI.md §5).
// Dos Graphics que se redibujan cada frame: suelo (bajo los actores) y aire (encima).
import { Container, Graphics, Text, type TextStyleOptions } from 'pixi.js';
import { RUN_COLORS } from '../config/render';
import { FX, JUICE } from '../config/run';
import { WEAPONS } from '../config/weapons';
import { ELITES, ENEMY_RULES } from '../config/enemies';
import type { World } from '../engine/types';
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
  chest: 0xc77dff,
  crate: 0xffffff,
  cache: RUN_COLORS.cacheTrim,
};

export class FxLayer {
  readonly ground = new Graphics();
  readonly air = new Graphics();
  /** Dibujos de los objetos del mapa: los que tienen dibujo solo llevan aquí su sombra o su halo. */
  art: PickupArt | null = null;

  draw(w: World): void {
    const g = this.ground;
    const a = this.air;
    g.clear();
    a.clear();
    const t = w.time;

    for (let i = 0; i < w.slimes.count; i++) {
      const s = w.slimes.items[i]!;
      groundCircle(g, s.x, s.y, s.r).fill({ color: RUN_COLORS.slime, alpha: 0.25 * (s.life / s.max) });
    }
    for (let i = 0; i < w.pools.count; i++) {
      const pl = w.pools.items[i]!;
      const c = pl.src === 'coctel' ? RUN_COLORS.pool : 0xff9f5a;
      groundCircle(g, pl.x, pl.y, pl.r).fill({ color: c, alpha: 0.35 * Math.min(1, pl.life / 0.5) });
    }
    for (let i = 0; i < w.tele.count; i++) {
      const tl = w.tele.items[i]!;
      const f = tl.t / tl.dur;
      // El último cuarto parpadea: ya va a caer.
      const blink = f > 0.75 ? 0.5 + 0.5 * Math.sin(t * 40) : 1;
      if (tl.lx !== 0 || tl.ly !== 0) {
        // Pasillo: rectángulo de anchura 2r a lo largo de (lx, ly), que se llena desde el origen.
        const len = Math.sqrt(tl.lx * tl.lx + tl.ly * tl.ly);
        const nx = (-tl.ly / len) * tl.r;
        const ny = (tl.lx / len) * tl.r;
        groundQuad(g, tl.x, tl.y, tl.lx, tl.ly, nx, ny).stroke({
          width: 2,
          color: RUN_COLORS.tele,
          alpha: 0.8 * blink,
        });
        groundQuad(g, tl.x, tl.y, tl.lx * f, tl.ly * f, nx, ny).fill({
          color: RUN_COLORS.tele,
          alpha: 0.22 * blink,
        });
        continue;
      }
      groundCircle(g, tl.x, tl.y, tl.r).stroke({ width: 2, color: RUN_COLORS.tele, alpha: 0.8 * blink });
      groundCircle(g, tl.x, tl.y, tl.r * f).fill({ color: RUN_COLORS.tele, alpha: 0.25 * blink });
    }
    // Zona del objetivo: anillo amarillo que late y se llena con el progreso.
    const ob = w.objective;
    if (ob) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 4);
      const f = Math.min(1, ob.progress / ob.goal);
      groundCircle(g, ob.x, ob.y, ob.r)
        .fill({ color: RUN_COLORS.objective, alpha: 0.06 + 0.05 * pulse })
        .stroke({ width: 3, color: RUN_COLORS.objective, alpha: 0.6 + 0.3 * pulse });
      if (f > 0) groundCircle(g, ob.x, ob.y, ob.r * f).fill({ color: RUN_COLORS.objective, alpha: 0.18 });
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
      if (this.art?.has('mine')) break;
      const m = w.mines.items[i]!;
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
    for (let i = 0; i < w.booms.count; i++) {
      const b = w.booms.items[i]!;
      const f = b.life / b.max;
      groundCircle(g, b.x, b.y, b.r * (1.1 - 0.3 * f)).fill({ color: b.color, alpha: 0.45 * f });
    }

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
      a.circle(sx, sy, Math.max(2.5, s.r * 0.8)).fill({ color: WEAPONS[s.src].color });
    }
    for (let i = 0; i < w.ebullets.count; i++) {
      const b = w.ebullets.items[i]!;
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
      a.circle(isoX(x, y), isoY(x, y) - h, 4).fill({ color: WEAPONS.coctel.color });
    }
    for (let i = 0; i < w.beams.count; i++) {
      const b = w.beams.items[i]!;
      if (b.n < 2) continue;
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
        a.rect(sx - s, sy - s * 0.4, s * 2, s * 0.8)
          .fill({ color: W.color })
          .stroke({ width: 1, color: 0x000000, alpha: 0.6 });
      }
    }
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
