// Render de la run con PixiJS v8. Lee el World y dibuja; nunca lo modifica.
import { Application, Assets, Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { ENTITIES, type AnimId } from '../config/entities';
import { PALETTE, RUN_COLORS, TILES, VIEW } from '../config/render';
import { currentWaveIndex } from '../engine/systems/spawning';
import type { World } from '../engine/types';
import { ActorView } from './actor';
import { EnemyLayer } from './enemyLayer';
import { FxLayer, TextLayer } from './fxLayer';
import { dirIndex, isoX, isoY } from './iso';
import type { SpriteLibrary } from './sprites';

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export interface DebugInfo {
  fps: number;
  steps: number;
}

export class GameRenderer {
  private readonly worldLayer = new Container();
  private readonly actors = new Container();
  private readonly ground = new Graphics();
  private readonly player: ActorView;
  private readonly enemies: EnemyLayer;
  private readonly fx = new FxLayer();
  private readonly texts: TextLayer;
  /** Tinte de pantalla completa: lluvia radiactiva, Tormenta, golpe recibido. */
  private readonly overlay = new Graphics();
  private readonly debugText: Text;
  private debugOn = false;
  /** Ajustes de accesibilidad (F3-08). */
  showDamage = true;
  reduceMotion = false;

  private constructor(
    readonly app: Application,
    private readonly lib: SpriteLibrary,
    world: World,
    translate: (key: string) => string,
    tiles: (Texture | null)[],
  ) {
    app.stage.addChild(this.worldLayer);
    this.drawGround(world);
    this.worldLayer.addChild(this.ground);
    this.worldLayer.addChild(this.tileGround(world, tiles));
    this.worldLayer.addChild(this.hazardLayer(world), this.fx.ground);
    // Actores ordenados por profundidad entre el suelo y el aire.
    this.actors.sortableChildren = true;
    this.worldLayer.addChild(this.actors);
    this.texts = new TextLayer(translate);
    this.worldLayer.addChild(this.fx.air, this.texts);

    this.player = new ActorView(ENTITIES[world.player.charId], lib, true);
    this.actors.addChild(this.player);
    this.enemies = new EnemyLayer(this.actors, lib);
    app.stage.addChild(this.overlay);

    this.debugText = new Text({
      text: '',
      style: { fontFamily: 'monospace', fontSize: 13, fill: PALETTE.crt, lineHeight: 17 },
    });
    this.debugText.position.set(10, 10);
    this.debugText.visible = false;
    app.stage.addChild(this.debugText);
  }

  /** Crea la aplicación Pixi dentro de `host` (se redimensiona con él). */
  static async create(
    host: HTMLElement,
    lib: SpriteLibrary,
    world: World,
    translate: (key: string) => string,
  ): Promise<GameRenderer> {
    const app = new Application();
    // DECISIÓN: Pixi v8 no trae renderer Canvas; se prefiere WebGL y Pixi cae a WebGPU/WebGL según soporte.
    await app.init({
      resizeTo: host,
      background: PALETTE.background,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(2, window.devicePixelRatio || 1),
      preference: 'webgl',
    });
    host.appendChild(app.canvas);
    // Las baldosas son opcionales: si faltan, queda el suelo liso con rejilla.
    const tiles = await Promise.all(
      TILES.weights.map((wgt, i) =>
        wgt > 0 ? Assets.load<Texture>(`${TILES.path}${i}.png`).catch(() => null) : Promise.resolve(null),
      ),
    );
    return new GameRenderer(app, lib, world, translate, tiles);
  }

  toggleDebug(): void {
    this.debugOn = !this.debugOn;
    this.debugText.visible = this.debugOn;
  }

  private drawGround(w: World): void {
    const M = w.mapSize;
    const g = this.ground;
    g.poly([isoX(0, 0), isoY(0, 0), isoX(M, 0), isoY(M, 0), isoX(M, M), isoY(M, M), isoX(0, M), isoY(0, M)])
      .fill({ color: PALETTE.ground })
      .stroke({ width: 4, color: PALETTE.mapEdge });
    for (let v = VIEW.gridStep; v < M; v += VIEW.gridStep) {
      g.moveTo(isoX(v, 0), isoY(v, 0)).lineTo(isoX(v, M), isoY(v, M));
      g.moveTo(isoX(0, v), isoY(0, v)).lineTo(isoX(M, v), isoY(M, v));
    }
    g.stroke({ width: 1, color: PALETTE.grid, alpha: PALETTE.gridAlpha });
  }

  /** Suelo de baldosas elegidas con una semilla fija por casilla (siempre el mismo mapa por semilla). */
  private tileGround(w: World, tiles: (Texture | null)[]): Container {
    const layer = new Container();
    const avail: number[] = tiles.map((t, i) => (t ? TILES.weights[i]! : 0));
    const total = avail.reduce((a, b) => a + b, 0);
    if (total === 0) return layer;
    const n = Math.round(w.mapSize / TILES.worldSize);
    const T = w.mapSize / n;
    // Un lado T del mundo mide T·√2 de ancho en la vista isométrica.
    const scale = ((T * Math.SQRT2) / TILES.imageWidth) * TILES.overlap;
    let h = (w.seed ^ 0x9e3779b9) >>> 0;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) + i * 7919 + j * 104729;
        h = (h ^ (h >>> 13)) >>> 0;
        let r = (h / 4294967296) * total;
        let k = 0;
        while (k < avail.length - 1 && r >= avail[k]!) r -= avail[k++]!;
        const tex = tiles[k];
        if (!tex) continue;
        const s = new Sprite(tex);
        s.anchor.set(0.5);
        s.scale.set(scale);
        s.tint = TILES.tint;
        const cx = (i + 0.5) * T;
        const cy = (j + 0.5) * T;
        s.position.set(isoX(cx, cy), isoY(cx, cy));
        layer.addChild(s);
      }
    }
    return layer;
  }

  /** Charcos radiactivos fijos. */
  private hazardLayer(w: World): Graphics {
    const g = new Graphics();
    for (const h of w.hazards) {
      g.ellipse(isoX(h.x, h.y), isoY(h.x, h.y), h.r, h.r / 2)
        .fill({ color: RUN_COLORS.hazard, alpha: RUN_COLORS.hazardAlpha })
        .stroke({ width: 2, color: RUN_COLORS.hazard, alpha: 0.35 });
    }
    return g;
  }

  /** Zoom de la cámara: encaja la vista de referencia en la pantalla. */
  private cameraScale(): number {
    const { width, height } = this.app.screen;
    return clamp(Math.min(width / VIEW.width, height / VIEW.height), VIEW.minScale, VIEW.maxScale);
  }

  /** Lo que ve la cámara en unidades isométricas de mundo (para que el motor spawnee fuera de ella). */
  viewHalfExtent(): { halfW: number; halfH: number } {
    const k = this.cameraScale();
    return { halfW: this.app.screen.width / 2 / k, halfH: this.app.screen.height / 2 / k };
  }

  /** `alpha` ∈ [0, 1) interpola entre el paso anterior y el actual del motor. */
  render(w: World, alpha: number, dbg: DebugInfo): void {
    const { width, height } = this.app.screen;
    const k = this.cameraScale();
    const p = w.player;
    const px = p.prevX + (p.x - p.prevX) * alpha;
    const py = p.prevY + (p.y - p.prevY) * alpha;

    this.worldLayer.scale.set(k);
    let shx = 0;
    let shy = 0;
    if (!this.reduceMotion && w.shake > 0.2) {
      shx = Math.sin(w.time * 97) * w.shake;
      shy = Math.cos(w.time * 89) * w.shake * 0.6;
    }
    this.worldLayer.position.set(width / 2 - isoX(px, py) * k + shx, height / 2 - isoY(px, py) * k + shy);

    // Animación del jugador (biblia §5): death una vez; run al moverse; idle quieto (cae a run si no hay idle).
    let anims: readonly AnimId[];
    let t: number;
    if (p.deadAt !== null) {
      anims = ['death'];
      t = w.time - p.deadAt;
    } else if (p.moving) {
      anims = ['run'];
      t = w.time;
    } else {
      anims = ['idle', 'run'];
      t = w.time;
    }
    const screenAngle = Math.atan2(isoY(p.facingX, p.facingY), isoX(p.facingX, p.facingY));
    this.player.show(anims, dirIndex(p.facingX, p.facingY), t, screenAngle);
    this.player.position.set(isoX(px, py), isoY(px, py));
    this.player.zIndex = px + py;
    const hurt = w.time - p.lastHit < 0.15;
    const blink = p.inv > 0 && p.deadAt === null && Math.floor(w.time * 20) % 2 === 0;
    this.player.style(0, hurt ? RUN_COLORS.flash : 0xffffff, blink ? 0.55 : 1);
    this.enemies.sync(w, alpha);
    this.fx.draw(w);
    this.texts.draw(w, this.showDamage && w.showDmg);

    const o = this.overlay;
    o.clear();
    if (w.rain > 0) o.rect(0, 0, width, height).fill({ color: RUN_COLORS.rain, alpha: 0.07 });
    if (w.storm)
      o.rect(0, 0, width, height).fill({
        color: RUN_COLORS.storm,
        alpha: 0.18 + 0.06 * Math.sin(w.time * 4),
      });
    if (!this.reduceMotion && hurt) o.rect(0, 0, width, height).fill({ color: 0xff0000, alpha: 0.12 });

    if (this.debugOn) {
      // DECISIÓN: el overlay F3 es una herramienta de desarrollo y no pasa por i18n.
      this.debugText.text =
        `FPS ${dbg.fps.toFixed(0)}  pasos/frame ${dbg.steps}\n` +
        `t ${w.time.toFixed(1)} s  ticks ${w.ticks}  oleada ${currentWaveIndex(w.time)}  enemigos ${w.enemies.count}\n` +
        `sprites ${this.lib.count}  ${p.charId} (${p.x.toFixed(0)}, ${p.y.toFixed(0)}) dir ${dirIndex(p.facingX, p.facingY)}`;
    }
  }

  destroy(): void {
    this.app.destroy(true, { children: true });
  }
}
