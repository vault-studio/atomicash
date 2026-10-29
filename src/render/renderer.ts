// Render de la run con PixiJS v8. Lee el World y dibuja; nunca lo modifica.
import { Application, Container, Graphics, Text } from 'pixi.js';
import { ENTITIES, type AnimId } from '../config/entities';
import { PALETTE, RUN_COLORS, VIEW } from '../config/render';
import { JUICE } from '../config/run';
import { currentWaveIndex } from '../engine/systems/spawning';
import type { World } from '../engine/types';
import { ActorView } from './actor';
import { EnemyLayer } from './enemyLayer';
import { FxLayer, TextLayer } from './fxLayer';
import { GroundView, loadGroundTiles, type GroundTiles } from './ground';
import { dirIndex, isoX, isoY } from './iso';
import { loadPickupArt, PickupLayer, type PickupArt } from './pickupLayer';
import type { SpriteLibrary } from './sprites';

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export interface DebugInfo {
  fps: number;
  steps: number;
}

export class GameRenderer {
  private readonly worldLayer = new Container();
  private readonly actors = new Container();
  private readonly groundView: GroundView;
  private readonly player: ActorView;
  private readonly enemies: EnemyLayer;
  private readonly pickups: PickupLayer | null;
  private readonly fx = new FxLayer();
  private readonly texts: TextLayer;
  /** Tinte de pantalla completa: lluvia radiactiva, Tormenta, golpe recibido. */
  private readonly overlay = new Graphics();
  private readonly debugText: Text;
  private debugOn = false;
  /** Zoom extra de la cámara: se aleja un poco con la pantalla llena de enemigos. */
  private zoom = 1;
  private lastFrame = 0;
  /** Ajustes de accesibilidad (F3-08). */
  showDamage = true;
  reduceMotion = false;

  private constructor(
    readonly app: Application,
    private readonly lib: SpriteLibrary,
    world: World,
    translate: (key: string) => string,
    tiles: GroundTiles | null,
    pickupArt: PickupArt | null,
  ) {
    app.stage.addChild(this.worldLayer);
    this.groundView = new GroundView(tiles, this.actors, world);
    this.worldLayer.addChild(this.groundView.layer, this.groundView.outlines, this.fx.ground);
    // Actores ordenados por profundidad entre el suelo y el aire.
    this.actors.sortableChildren = true;
    this.worldLayer.addChild(this.actors);
    this.texts = new TextLayer(translate);
    this.worldLayer.addChild(this.fx.air, this.texts);

    this.player = new ActorView(ENTITIES[world.player.charId], lib, true);
    this.actors.addChild(this.player);
    this.enemies = new EnemyLayer(this.actors, lib);
    this.pickups = pickupArt ? new PickupLayer(this.actors, pickupArt) : null;
    this.fx.art = pickupArt;
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
    // Las baldosas son opcionales: si faltan, queda el fondo liso con los charcos dibujados.
    // Igual los dibujos de los objetos del mapa: sin ellos quedan los placeholders.
    const [tiles, pickupArt] = await Promise.all([
      loadGroundTiles().catch(() => null),
      loadPickupArt().catch(() => null),
    ]);
    return new GameRenderer(app, lib, world, translate, tiles, pickupArt);
  }

  toggleDebug(): void {
    this.debugOn = !this.debugOn;
    this.debugText.visible = this.debugOn;
  }

  /** Zoom de la cámara: encaja la vista de referencia en la pantalla. */
  private cameraScale(): number {
    const { width, height } = this.app.screen;
    return (
      clamp(Math.min(width / VIEW.width, height / VIEW.height), VIEW.minScale, VIEW.maxScale) * this.zoom
    );
  }

  /** Lo que ve la cámara en unidades isométricas de mundo (para que el motor spawnee fuera de ella). */
  viewHalfExtent(): { halfW: number; halfH: number } {
    const k = this.cameraScale();
    return { halfW: this.app.screen.width / 2 / k, halfH: this.app.screen.height / 2 / k };
  }

  /** `alpha` ∈ [0, 1) interpola entre el paso anterior y el actual del motor. */
  render(w: World, alpha: number, dbg: DebugInfo): void {
    const { width, height } = this.app.screen;
    const now = performance.now();
    const dt = Math.min(0.1, (now - (this.lastFrame || now)) / 1000);
    this.lastFrame = now;
    const Z = JUICE.zoom;
    const crowd = clamp((w.enemies.count - Z.from) / (Z.to - Z.from), 0, 1);
    const target = this.reduceMotion ? 1 : 1 - (1 - Z.minZoom) * crowd;
    this.zoom += (target - this.zoom) * Math.min(1, Z.lerp * dt);
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
    this.groundView.update(px, py, width / 2 / k, height / 2 / k);

    // Animación del jugador (biblia §5): death una vez; run al moverse; idle quieto. Sin hoja de idle, quieto se
    // queda en el primer fotograma de run en vez de correr sin moverse.
    let anims: readonly AnimId[];
    let t: number;
    if (p.deadAt !== null) {
      anims = ['death'];
      t = w.time - p.deadAt;
    } else if (p.moving) {
      anims = ['run'];
      t = w.time;
    } else if (this.lib.has(w.charId, 'idle')) {
      anims = ['idle'];
      t = w.time;
    } else {
      anims = ['run'];
      t = 0;
    }
    const screenAngle = Math.atan2(isoY(p.facingX, p.facingY), isoX(p.facingX, p.facingY));
    this.player.show(anims, dirIndex(p.facingX, p.facingY), t, screenAngle);
    this.player.position.set(isoX(px, py), isoY(px, py));
    this.player.zIndex = px + py;
    const hurt = w.time - p.lastHit < 0.15;
    const blink = p.inv > 0 && p.deadAt === null && Math.floor(w.time * 20) % 2 === 0;
    this.player.style(0, hurt ? RUN_COLORS.flash : 0xffffff, blink ? 0.55 : 1);
    this.enemies.sync(w, alpha);
    this.pickups?.sync(w);
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
