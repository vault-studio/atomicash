// Capa de efectos: orden de dibujo bajo y sobre los actores, y efectos sobre enemigos, restos y jugador.
import { Graphics } from 'pixi.js';
import { FX_ART } from '../../config/render';
import { ELITES } from '../../config/enemies';
import type { World } from '../../engine/types';
import type { FxSprites } from '../fxSprites';
import { isoX, isoY } from '../iso';
import type { PickupArt } from '../pickupLayer';
import { wreckRand, wreckWidth } from '../wreck/wreckMath';
import { drawAir } from './air';
import { drawPools } from './groundFx';
import { drawBooms, drawGroundItems } from './items';
import { FLY_HEIGHT, flyLift, groundCircle } from './shapes';
import { drawAuras, drawZones } from './zones';

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

  draw(w: World): void {
    const g = this.ground;
    const a = this.air;
    g.clear();
    a.clear();
    const sg = this.sg;
    const sa = this.sa;
    sg?.begin();
    sa?.begin();
    drawPools(this, w);
    drawZones(this, w);
    drawAuras(this, w);
    drawGroundItems(this, w);
    drawBooms(this, w);
    this.drawEnemyFx(w);
    this.drawWreckFx(w);
    this.drawPlayerFx(w);

    drawAir(this, w);
    sg?.end();
    sa?.end();
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

  /** Robots que revientan: explosiones en cadena, más cuanto más grande sea, y la mancha quemada que dejan. */
  private drawWreckFx(w: World): void {
    const X = FX_ART.wreck;
    const B = X.blast;
    const S = X.scorch;
    const sa = this.sa;
    const sg = this.sg;
    for (let i = 0; i < w.wrecks.count; i++) {
      const c = w.wrecks.items[i]!;
      const age = w.time - c.t;
      const width = wreckWidth(c.sprite) * (c.elite ? ELITES.scale : 1);
      const shown = Math.min(1, age / S.in) * Math.min(1, (c.until - w.time) / X.fade);
      const sx = isoX(c.x, c.y);
      if (sg?.has(S.strip)) {
        const frame = Math.floor(wreckRand(c.seed, 0, 22) * sg.frames(S.strip));
        sg.put(S.strip, frame, sx, isoY(c.x, c.y), width * S.w, {
          alpha: S.artAlpha * shown,
          flip: wreckRand(c.seed, 0, 23) < 0.5,
        });
      } else
        groundCircle(this.ground, c.x, c.y, width * S.r).fill({ color: S.color, alpha: S.alpha * shown });
      if (!sa) continue;
      const sy = isoY(c.x, c.y) - (c.flying ? flyLift(c.sprite) : 0);
      const n = Math.min(B.max, Math.ceil(width / B.per));
      for (let k = 0; k < n; k++) {
        const t = age - k * B.gap;
        if (t < 0 || t >= B.dur) continue;
        const ox = k === 0 ? 0 : (wreckRand(c.seed, k, 20) - 0.5) * width * B.spread;
        const oy = k === 0 ? 0 : (wreckRand(c.seed, k, 21) - 0.5) * width * B.spread * 0.5;
        sa.put(
          'fire_blast',
          sa.once('fire_blast', t / B.dur),
          sx + ox,
          sy + oy,
          (width * B.w) / Math.sqrt(n),
          {
            ay: B.ay,
            flip: (k & 1) === 1,
          },
        );
      }
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
