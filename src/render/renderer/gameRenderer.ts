// Render de la partida: capas, cámara, animación del jugador, tintes de pantalla y depuración (F3).
import { Application, Container, Graphics, Sprite, Text } from 'pixi.js';
import { LAST_ACT, type ActId } from '../../config/acts';
import { ENTITIES, type AnimId } from '../../config/entities';
import { PALETTE, RUN_COLORS, VIEW } from '../../config/render';
import { JUICE } from '../../config/run';
import { actCurtain, actTime } from '../../engine/systems/campaign';
import { currentWaveIndex } from '../../engine/systems/spawning';
import type { Enemy, World } from '../../engine/types';
import { ActorView } from '../actor';
import { EnemyLayer } from '../enemyLayer';
import { FxLayer, TextLayer } from '../fx';
import { FxSprites, loadFxArt, type FxArt } from '../fxSprites';
import { GroundView, loadGroundTiles, type GroundTiles } from '../ground';
import { dirIndex, isoX, isoY } from '../iso';
import { OldScreenFilter } from '../oldScreen';
import { loadPickupArt, PickupLayer, type PickupArt } from '../pickupLayer';
import { WreckLayer } from '../wreck';
import type { SpriteLibrary } from '../sprites';
import {
  drawDefeatText,
  drawVictory,
  startDefeat,
  startVictory,
  stepVictory,
  victoryHolding,
  victoryLevel,
} from './cinematics';
import { drawRadFog, fogTexture } from './radFog';

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const smooth = (x: number): number => x * x * (3 - 2 * x);

export interface DebugInfo {
  fps: number;
  steps: number;
}

export class GameRenderer {
  readonly worldLayer = new Container();
  private readonly actors = new Container();
  private readonly groundView: GroundView;
  private readonly player: ActorView;
  private readonly enemies: EnemyLayer;
  private readonly wrecks: WreckLayer;
  private readonly pickups: PickupLayer | null;
  private readonly fx = new FxLayer();
  private readonly texts: TextLayer;
  /** Tinte de pantalla completa: lluvia radiactiva, Tormenta, golpe recibido. */
  readonly overlay = new Graphics();
  /** Niebla de radiación: un degradado radial alrededor del personaje y, fuera de él, verde liso. */
  readonly fog = new Container();
  readonly fogHole = new Sprite(fogTexture());
  readonly fogEdge = new Graphics();
  /** Cortina negra del cambio de acto, encima de todo el mundo. */
  private readonly curtain = new Graphics();
  /** Acto que pinta el suelo, baldosas ya cargadas por acto (null si fallaron) y las que se están cargando. */
  private groundAct: ActId;
  private readonly actTiles = new Map<ActId, GroundTiles | null>();
  private readonly actLoading = new Set<ActId>();
  /** Luces de la cinemática de victoria: rayos tras el personaje y chispas delante. */
  readonly cineBack = new Graphics();
  readonly cineFront = new Graphics();
  /** Segundos de cinemática transcurridos (-1 = no hay) y su duración. */
  victoryT = -1;
  victoryDur = 0;
  /** Cuándo acaba la animación (ahí se espera si hace falta) y reloj de las luces, que no se para al esperar. */
  victoryHoldAt = 0;
  victoryClock = 0;
  /** Cinemática de derrota: el enemigo que celebra (null = la cinemática es la del personaje). */
  victor: Enemy | null = null;
  /** «¡Perdiste!» de la cinemática de derrota, en coordenadas de pantalla. */
  readonly defeatText: Text;
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
    readonly lib: SpriteLibrary,
    world: World,
    translate: (key: string) => string,
    tiles: GroundTiles | null,
    pickupArt: PickupArt | null,
    fxArt: FxArt | null,
  ) {
    if (fxArt) {
      this.fx.sg = new FxSprites(fxArt);
      this.fx.sa = new FxSprites(fxArt);
    }
    app.stage.addChild(this.worldLayer);
    this.groundAct = world.act;
    this.actTiles.set(world.act, tiles);
    this.groundView = new GroundView(tiles, this.actors, world);
    this.worldLayer.addChild(this.groundView.layer, this.groundView.outlines, this.fx.ground);
    if (this.fx.sg) this.worldLayer.addChild(this.fx.sg.layer);
    this.wrecks = new WreckLayer(lib);
    this.worldLayer.addChild(this.wrecks.ground);
    this.worldLayer.addChild(this.cineBack);
    // Actores ordenados por profundidad entre el suelo y el aire.
    this.actors.sortableChildren = true;
    this.worldLayer.addChild(this.actors);
    this.texts = new TextLayer(translate);
    this.worldLayer.addChild(this.wrecks.air, this.fx.air);
    if (this.fx.sa) this.worldLayer.addChild(this.fx.sa.layer);
    this.worldLayer.addChild(this.cineFront, this.texts);
    this.cineBack.blendMode = 'add';
    this.cineFront.blendMode = 'add';

    this.player = new ActorView(ENTITIES[world.player.charId], lib, true);
    this.actors.addChild(this.player);
    this.enemies = new EnemyLayer(this.actors, lib);
    this.pickups = pickupArt ? new PickupLayer(this.actors, pickupArt) : null;
    this.fx.art = pickupArt;
    this.fog.addChild(this.fogHole, this.fogEdge);
    this.fog.visible = false;
    app.stage.addChild(this.fog, this.overlay, this.curtain);
    this.defeatText = new Text({
      text: translate('run.defeat'),
      style: {
        fontFamily: '"Pixelify Sans", monospace',
        fontWeight: '700',
        fontSize: 72,
        fill: RUN_COLORS.defeatText,
        stroke: { color: 0x000000, width: 10, join: 'round' },
        dropShadow: { color: 0x000000, alpha: 0.6, blur: 6, distance: 6 },
      },
    });
    this.defeatText.anchor.set(0.5);
    this.defeatText.visible = false;
    app.stage.addChild(this.defeatText);

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
    // Igual los dibujos de los objetos del mapa y de los efectos: sin ellos quedan los placeholders.
    const [tiles, pickupArt, fxArt] = await Promise.all([
      loadGroundTiles(world.act).catch(() => null),
      loadPickupArt().catch(() => null),
      loadFxArt().catch(() => null),
    ]);
    return new GameRenderer(app, lib, world, translate, tiles, pickupArt, fxArt);
  }

  /** Carga las baldosas de un acto en segundo plano. Si fallan, ese acto sigue sin baldosas. */
  private loadAct(act: ActId): void {
    if (this.actTiles.has(act) || this.actLoading.has(act)) return;
    this.actLoading.add(act);
    void loadGroundTiles(act)
      .catch(() => null)
      .then((tiles) => {
        this.actTiles.set(act, tiles);
        this.actLoading.delete(act);
      });
  }

  /** Precarga el acto siguiente al caer el jefe y cambia el suelo con `w.act`. Devuelve si el suelo del acto está listo. */
  private syncAct(w: World): boolean {
    if (w.actClearAt >= 0 && w.act < LAST_ACT) this.loadAct((w.act + 1) as ActId);
    if (w.act === this.groundAct) return true;
    this.loadAct(w.act);
    const tiles = this.actTiles.get(w.act);
    if (tiles === undefined) return false;
    this.groundView.setAct(tiles, w.act);
    this.groundAct = w.act;
    return true;
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
    return startVictory(this, charId);
  }

  /** Arranca la cinemática de derrota con `e` (el Coloso) celebrando. Devuelve su duración en s. */
  startDefeat(e: Enemy): number {
    return startDefeat(this, e);
  }

  /** La animación ya terminó y la cámara sigue cerca: momento de enseñar la máquina de cupones. */
  get victoryHolding(): boolean {
    return victoryHolding(this);
  }

  /** Avanza la cinemática `dt` s; ver `stepVictory` en cinematics.ts. */
  stepVictory(dt: number, hold: boolean): number {
    return stepVictory(this, dt, hold);
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
    const D = JUICE.defeat;
    const cine = victoryLevel(this);
    // Con «reducir movimiento» la cinemática no hace zoom: solo luces.
    const close = this.reduceMotion ? 0 : cine;
    const vic = this.victor;
    const k = this.cameraScale() * (1 + ((vic ? D.zoom : V.zoom) - 1) * close);
    const p = w.player;
    const px = p.prevX + (p.x - p.prevX) * alpha;
    const py = p.prevY + (p.y - p.prevY) * alpha;
    // En la derrota la cámara va del personaje al que lo ha matado.
    const fx = vic ? px + (vic.x - px) * cine : px;
    const fy = vic ? py + (vic.y - py) * cine : py;

    this.worldLayer.scale.set(k);
    let shx = 0;
    let shy = 0;
    if (!this.reduceMotion && w.shake > 0.2 && this.victoryT < 0) {
      shx = Math.sin(w.time * 97) * w.shake;
      shy = Math.cos(w.time * 89) * w.shake * 0.6;
    }
    // La cámara sube con el zoom para encuadrar el cuerpo, no los pies.
    const lift = (vic ? D.lift : V.lift) * close;
    this.worldLayer.position.set(
      width / 2 - isoX(fx, fy) * k + shx,
      height / 2 - (isoY(fx, fy) - lift) * k + shy,
    );
    const groundReady = this.syncAct(w);
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
      // En la derrota el mundo está parado: la caída sigue al reloj de la cinemática.
      t = w.time - p.deadAt + (vic ? this.victoryT : 0);
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
    this.enemies.sync(w, alpha, vic, this.victoryT);
    this.wrecks.sync(w);
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
    drawRadFog(this, p.rad, isoX(px, py), isoY(px, py), k, w.time);
    if (this.victoryT >= 0) {
      if (vic) {
        drawVictory(this, isoX(vic.x, vic.y), isoY(vic.x, vic.y), cine, k, true);
        drawDefeatText(this, width, height);
      } else drawVictory(this, isoX(px, py), isoY(px, py), cine, k, false);
    }

    const c = this.curtain;
    c.clear();
    const shut = groundReady ? actCurtain(w) : 1;
    if (shut > 0) c.rect(0, 0, width, height).fill({ color: 0x000000, alpha: shut });

    if (this.debugOn) {
      // DECISIÓN: el overlay F3 es una herramienta de desarrollo y no pasa por i18n.
      this.debugText.text =
        `FPS ${dbg.fps.toFixed(0)}  pasos/frame ${dbg.steps}\n` +
        `t ${w.time.toFixed(1)} s  acto ${w.act} (${actTime(w).toFixed(1)} s)  ticks ${w.ticks}  oleada ${currentWaveIndex(w.act, actTime(w))}  enemigos ${w.enemies.count}\n` +
        `sprites ${this.lib.count}  ${p.charId} (${p.x.toFixed(0)}, ${p.y.toFixed(0)}) dir ${dirIndex(p.facingX, p.facingY)}`;
    }
  }

  destroy(): void {
    this.app.destroy(true, { children: true });
  }
}
