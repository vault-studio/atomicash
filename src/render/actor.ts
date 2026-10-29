// Vista de una entidad: sprite de la hoja si existe, placeholder si no.
import { Container, Sprite, type Texture } from 'pixi.js';
import type { AnimId, EntityDef } from '../config/entities';
import { VIEW } from '../config/render';
import { Placeholder } from './placeholders';
import type { SpriteLibrary } from './sprites';

export class ActorView extends Container {
  private readonly sprite = new Sprite();
  /** Copia del sprite en mezcla aditiva para el destello blanco del golpe. */
  private readonly glow = new Sprite();
  private readonly placeholder: Placeholder;
  private readonly cellScale: number;
  /** Contenedor del cuerpo: se eleva para los voladores. */
  private readonly body = new Container();

  constructor(
    private readonly def: EntityDef,
    private readonly lib: SpriteLibrary,
    withArrow: boolean,
  ) {
    super();
    this.cellScale = def.size * VIEW.scalePerSize[def.category];
    this.placeholder = new Placeholder(
      def.color,
      def.id,
      def.size * VIEW.placeholderRadiusPerSize,
      withArrow,
    );
    this.glow.blendMode = 'add';
    this.glow.visible = false;
    this.body.addChild(this.sprite, this.glow, this.placeholder);
    this.addChild(this.body);
  }

  /**
   * Altura de vuelo en px de pantalla, tinte (irradiado, congelado), transparencia y destello del golpe (0–1): el
   * destello aclara el sprite y lo aplasta un poco.
   */
  style(lift: number, tint: number, alpha: number, flash = 0, squash = 0): void {
    this.body.y = -lift;
    this.sprite.tint = tint;
    this.placeholder.tint = tint;
    this.body.alpha = alpha;
    const on = flash > 0 && this.sprite.visible;
    this.glow.visible = on;
    if (on) {
      this.glow.texture = this.sprite.texture;
      this.glow.anchor.copyFrom(this.sprite.anchor);
      this.glow.alpha = flash;
    }
    const k = flash * squash;
    this.body.scale.set(1 + k, 1 - k);
  }

  get entityId(): string {
    return this.def.id;
  }

  /**
   * Muestra la primera animación de `anims` que tenga hoja (p. ej. idle → run). Una variante de fase sin hojas
   * propias usa las de su base (rey_rata_dmg → rey_rata).
   * `t` son los segundos desde que empezó la animación; `dir` la fila 0–7.
   */
  show(anims: readonly AnimId[], dir: number, t: number, screenAngle: number): void {
    let tex: Texture | null = null;
    let anim: AnimId | undefined;
    let id: string = this.def.id;
    for (const candidate of this.def.variantOf ? [this.def.id, this.def.variantOf] : [this.def.id]) {
      for (const a of anims) {
        tex = this.lib.frame(candidate, a, dir, t);
        if (tex) {
          anim = a;
          id = candidate;
          break;
        }
      }
      if (tex) break;
    }
    const meta = anim ? this.lib.meta(id, anim) : null;
    if (tex && meta) {
      this.sprite.texture = tex;
      this.sprite.anchor.set(meta.pivot[0] / meta.cell[0], meta.pivot[1] / meta.cell[1]);
      this.sprite.scale.set(this.cellScale);
      this.glow.scale.set(this.cellScale);
      this.sprite.visible = true;
      this.placeholder.visible = false;
    } else {
      this.sprite.visible = false;
      this.placeholder.visible = true;
      this.placeholder.setFacing(screenAngle);
    }
  }
}
