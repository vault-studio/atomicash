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
import { OldScreenFilter } from './oldScreen';
import { loadPickupArt, PickupLayer, type PickupArt } from './pickupLayer';
import { animDuration } from './spriteMeta';
import type { SpriteLibrary } from './sprites';

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const smooth = (x: number): number => x * x * (3 - 2 * x);

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
  /** Luces de la cinemática de victoria: rayos tras el personaje y chispas delante. */
  private readonly cineBack = new Graphics();
  private readonly cineFront = new Graphics();
  /** Segundos de cinemática transcurridos (-1 = no hay) y su duración. */
  private victoryT = -1;
  private victoryDur = 0;
  /** Cuándo acaba la animación (ahí se espera si hace falta) y reloj de las luces, que no se para al esperar. */
  private victoryHoldAt = 0;
  private victoryClock = 0;
  /** Momento en que el jugador se paró: el idle empieza desde su primer fotograma. */
  private stillSince = -1;
  private readonly debugText: Text;
  private debugOn = false;
  /** Zoom extra de la cámara: se aleja un poco con la pantalla llena de enemigos. */
  private zoom = 1;
  private lastFrame = 0;
  /** Filtro de pantalla vieja (null si está apagado o el renderer no es WebGL). */
  private oldScreen: OldScreenFilter | null = null;
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
    this.worldLayer.addChild(this.groundView.layer, this.groundView.outlines, this.fx.ground, this.cineBack);
    // Actores ordenados por profundidad entre el suelo y el aire.
    this.actors.sortableChildren = true;
    this.worldLayer.addChild(this.actors);
    this.texts = new TextLayer(translate);
    this.worldLayer.addChild(this.fx.air, this.cineFront, this.texts);
    this.cineBack.blendMode = 'add';
    this.cineFront.blendMode = 'add';

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

  /** Enciende o apaga el filtro de pantalla vieja sobre todo el lienzo. */
  setOldScreen(on: boolean): void {
    if (on && !this.oldScreen && this.app.renderer.name === 'webgl') {
      this.oldScreen = new OldScreenFilter();
      this.app.stage.filterArea = this.app.screen;
      this.app.stage.filters = [this.oldScreen];
    } else if (!on && this.oldScreen) {
      this.app.stage.filters = [];
      this.oldScreen.destroy();
      this.oldScreen = null;
    }
  }

  toggleDebug(): void {
    this.debugOn = !this.debugOn;
    this.debugText.visible = this.debugOn;
  }

  /** Arranca la cinemática de victoria del personaje `charId`. Devuelve su duración en s. */
  startVictory(charId: string): number {
    const V = JUICE.victory;
    const meta = this.lib.meta(charId, 'victory');
    this.victoryT = 0;
    this.victoryClock = 0;
    this.victoryHoldAt = (meta ? animDuration(meta) : V.fallback) + V.hold;
    this.victoryDur = this.victoryHoldAt + V.zoomOut;
    return this.victoryDur;
  }

  /** La animación ya terminó y la cámara sigue cerca: momento de enseñar la máquina de cupones. */
  get victoryHolding(): boolean {
    return this.victoryT >= this.victoryHoldAt;
  }

  /**
   * Avanza la cinemática `dt` s. Con `hold` se queda en primer plano al acabar la animación (la máquina de cupones
   * sigue abierta); sin él, vuelve al zoom normal. Devuelve los segundos que le quedan (0 = terminada).
   */
  stepVictory(dt: number, hold: boolean): number {
    if (this.victoryT < 0) return 0;
    this.victoryClock += dt;
    this.victoryT += dt;
    if (hold) this.victoryT = Math.min(this.victoryT, this.victoryHoldAt);
    if (this.victoryT < this.victoryDur) return this.victoryDur - this.victoryT;
    this.victoryT = -1;
    this.cineBack.clear();
    this.cineFront.clear();
    return 0;
  }

  /** Intensidad 0–1 de la cinemática: sube al entrar y baja al salir. */
  private victoryLevel(): number {
    if (this.victoryT < 0) return 0;
    const V = JUICE.victory;
    const t = this.victoryT;
    return smooth(clamp(Math.min(t / V.zoomIn, (this.victoryDur - t) / V.zoomOut), 0, 1));
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
    this.oldScreen?.update(now / 1000, this.reduceMotion);
    const Z = JUICE.zoom;
    const crowd = clamp((w.enemies.count - Z.from) / (Z.to - Z.from), 0, 1);
    const target = this.reduceMotion ? 1 : 1 - (1 - Z.minZoom) * crowd;
    this.zoom += (target - this.zoom) * Math.min(1, Z.lerp * dt);
    const V = JUICE.victory;
    const cine = this.victoryLevel();
    // Con «reducir movimiento» la cinemática no hace zoom: solo luces.
    const close = this.reduceMotion ? 0 : cine;
    const k = this.cameraScale() * (1 + (V.zoom - 1) * close);
    const p = w.player;
    const px = p.prevX + (p.x - p.prevX) * alpha;
    const py = p.prevY + (p.y - p.prevY) * alpha;

    this.worldLayer.scale.set(k);
    let shx = 0;
    let shy = 0;
    if (!this.reduceMotion && w.shake > 0.2 && this.victoryT < 0) {
      shx = Math.sin(w.time * 97) * w.shake;
      shy = Math.cos(w.time * 89) * w.shake * 0.6;
    }
    // La cámara sube con el zoom para encuadrar el cuerpo, no los pies.
    const lift = V.lift * close;
    this.worldLayer.position.set(
      width / 2 - isoX(px, py) * k + shx,
      height / 2 - (isoY(px, py) - lift) * k + shy,
    );
    this.groundView.update(px, py, width / 2 / k, height / 2 / k);

    // Animación del jugador (biblia §5): death una vez; run al moverse; idle quieto. Sin hoja de idle, quieto se
    // queda en el primer fotograma de run en vez de correr sin moverse.
    // En la cinemática de victoria mira a cámara (fila S).
    let anims: readonly AnimId[];
    let t: number;
    let dir = dirIndex(p.facingX, p.facingY);
    if (p.moving) this.stillSince = -1;
    else if (this.stillSince < 0) this.stillSince = w.time;
    if (p.deadAt !== null) {
      anims = ['death'];
      t = w.time - p.deadAt;
    } else if (this.victoryT >= 0) {
      anims = ['victory', 'idle', 'run'];
      t = this.victoryT;
      dir = 0;
    } else if (p.moving) {
      anims = ['run'];
      t = w.time;
    } else if (this.lib.has(w.charId, 'idle')) {
      anims = ['idle'];
      t = w.time - this.stillSince;
    } else {
      anims = ['run'];
      t = 0;
    }
    const screenAngle = Math.atan2(isoY(p.facingX, p.facingY), isoX(p.facingX, p.facingY));
    this.player.show(anims, dir, t, screenAngle);
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
    if (!this.reduceMotion && hurt && this.victoryT < 0)
      o.rect(0, 0, width, height).fill({ color: 0xff0000, alpha: 0.12 });
    if (this.victoryT >= 0) this.drawVictory(isoX(px, py), isoY(px, py), cine, k);

    if (this.debugOn) {
      // DECISIÓN: el overlay F3 es una herramienta de desarrollo y no pasa por i18n.
      this.debugText.text =
        `FPS ${dbg.fps.toFixed(0)}  pasos/frame ${dbg.steps}\n` +
        `t ${w.time.toFixed(1)} s  ticks ${w.ticks}  oleada ${currentWaveIndex(w.time)}  enemigos ${w.enemies.count}\n` +
        `sprites ${this.lib.count}  ${p.charId} (${p.x.toFixed(0)}, ${p.y.toFixed(0)}) dir ${dirIndex(p.facingX, p.facingY)}`;
    }
  }

  /**
   * Luces de la cinemática con los pies del personaje en (x, y) de mundo: rayos que giran tras él, halo en el suelo,
   * onda expansiva y chispas que suben; en pantalla, viñeta que oscurece lo demás y fogonazo inicial.
   */
  private drawVictory(x: number, y: number, level: number, k: number): void {
    const V = JUICE.victory;
    const t = this.victoryClock;
    const cy = y - V.lift;
    const back = this.cineBack;
    const front = this.cineFront;
    back.clear();
    front.clear();

    const reach = 150 + 30 * Math.sin(t * 3);
    for (let i = 0; i < V.rays; i++) {
      const a = t * 0.6 + (i / V.rays) * Math.PI * 2;
      const half = 0.07 + 0.03 * Math.sin(t * 5 + i);
      const r = reach * (i % 2 ? 0.75 : 1);
      back
        .poly([
          x,
          cy,
          x + Math.cos(a - half) * r,
          cy + Math.sin(a - half) * r,
          x + Math.cos(a + half) * r,
          cy + Math.sin(a + half) * r,
        ])
        .fill({ color: i % 2 ? RUN_COLORS.victoryB : RUN_COLORS.victoryA, alpha: 0.22 * level });
    }
    for (let i = 3; i >= 1; i--)
      back.ellipse(x, y, 26 * i, 13 * i).fill({ color: RUN_COLORS.victoryA, alpha: 0.12 * level });
    if (t < 0.7) {
      const s = t / 0.7;
      back
        .ellipse(x, y, 40 + 220 * s, 20 + 110 * s)
        .stroke({ color: RUN_COLORS.victoryB, width: 6 * (1 - s), alpha: 1 - s });
    }

    // Chispas: cada una sube en espiral alrededor del personaje y vuelve a empezar.
    for (let i = 0; i < 26; i++) {
      const life = (t * (0.5 + (i % 5) * 0.12) + i * 0.137) % 1;
      const a = i * 2.39996 + t * (i % 2 ? 1.3 : -1.1);
      const r = 26 + (i % 7) * 7;
      const sx = x + Math.cos(a) * r;
      const sy = y - life * 120 + Math.sin(a) * r * 0.45;
      front
        .circle(sx, sy, (1.6 + (i % 3)) * (1 - life))
        .fill({ color: i % 3 ? RUN_COLORS.victoryA : 0xffffff, alpha: level * (1 - life) });
    }

    // Viñeta: anillos con el centro recortado; se suman hacia fuera y dejan la luz sobre el personaje.
    const { width, height } = this.app.screen;
    const ox = this.worldLayer.position.x + x * k;
    const oy = this.worldLayer.position.y + cy * k;
    const o = this.overlay;
    for (let i = 0; i < 6; i++)
      o.rect(0, 0, width, height)
        .fill({ color: 0x000000, alpha: 0.12 * level })
        .circle(ox, oy, height * (0.2 + i * 0.06))
        .cut();
    if (t < 0.18 && !this.reduceMotion)
      o.rect(0, 0, width, height).fill({ color: 0xffffff, alpha: 0.5 * (1 - t / 0.18) });
  }

  destroy(): void {
    this.app.destroy(true, { children: true });
  }
}
