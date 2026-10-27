// Render de la run con PixiJS v8. Lee el World y dibuja; nunca lo modifica.
import { Application, Container, Graphics, Text } from 'pixi.js';
import { ENTITIES, type AnimId } from '../config/entities';
import { PALETTE, VIEW } from '../config/render';
import { currentWaveIndex } from '../engine/systems/spawning';
import type { World } from '../engine/types';
import { ActorView } from './actor';
import { EnemyLayer } from './enemyLayer';
import { dirIndex, isoX, isoY } from './iso';
import type { SpriteLibrary } from './sprites';

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export interface DebugInfo {
  fps: number;
  steps: number;
}

export class GameRenderer {
  private readonly worldLayer = new Container();
  private readonly ground = new Graphics();
  private readonly player: ActorView;
  private readonly enemies: EnemyLayer;
  private readonly debugText: Text;
  private debugOn = false;

  private constructor(
    readonly app: Application,
    private readonly lib: SpriteLibrary,
    world: World,
  ) {
    app.stage.addChild(this.worldLayer);
    this.worldLayer.sortableChildren = true;
    this.drawGround(world.mapSize);
    this.worldLayer.addChild(this.ground);

    this.player = new ActorView(ENTITIES[world.player.charId], lib, true);
    this.worldLayer.addChild(this.player);
    this.enemies = new EnemyLayer(this.worldLayer, lib);

    this.debugText = new Text({
      text: '',
      style: { fontFamily: 'monospace', fontSize: 13, fill: PALETTE.crt, lineHeight: 17 },
    });
    this.debugText.position.set(10, 10);
    this.debugText.visible = false;
    app.stage.addChild(this.debugText);
  }

  /** Crea la aplicación Pixi dentro de `host` (se redimensiona con él). */
  static async create(host: HTMLElement, lib: SpriteLibrary, world: World): Promise<GameRenderer> {
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
    return new GameRenderer(app, lib, world);
  }

  toggleDebug(): void {
    this.debugOn = !this.debugOn;
    this.debugText.visible = this.debugOn;
  }

  private drawGround(M: number): void {
    const g = this.ground;
    g.zIndex = -1e9;
    g.poly([isoX(0, 0), isoY(0, 0), isoX(M, 0), isoY(M, 0), isoX(M, M), isoY(M, M), isoX(0, M), isoY(0, M)])
      .fill({ color: PALETTE.ground })
      .stroke({ width: 4, color: PALETTE.mapEdge });
    for (let v = VIEW.gridStep; v < M; v += VIEW.gridStep) {
      g.moveTo(isoX(v, 0), isoY(v, 0)).lineTo(isoX(v, M), isoY(v, M));
      g.moveTo(isoX(0, v), isoY(0, v)).lineTo(isoX(M, v), isoY(M, v));
    }
    g.stroke({ width: 1, color: PALETTE.grid, alpha: PALETTE.gridAlpha });
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
    this.worldLayer.position.set(width / 2 - isoX(px, py) * k, height / 2 - isoY(px, py) * k);

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
    this.enemies.sync(w, alpha);

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
