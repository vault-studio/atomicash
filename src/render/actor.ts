// Vista de una entidad: sprite de la hoja si existe, placeholder si no.
import { Container, Sprite, type Texture } from 'pixi.js';
import type { AnimId, EntityDef } from '../config/entities';
import { VIEW } from '../config/render';
import { Placeholder } from './placeholders';
import type { SpriteLibrary } from './sprites';

export class ActorView extends Container {
  private readonly sprite = new Sprite();
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
    this.body.addChild(this.sprite, this.placeholder);
    this.addChild(this.body);
  }

  /** Altura de vuelo en px de pantalla, tinte (irradiado, golpe) y transparencia. */
  style(lift: number, tint: number, alpha: number): void {
    this.body.y = -lift;
    this.sprite.tint = tint;
    this.placeholder.tint = tint;
    this.body.alpha = alpha;
  }

  get entityId(): string {
    return this.def.id;
  }

  /**
   * Muestra la primera animación de `anims` que tenga hoja (p. ej. idle → run).
   * `t` son los segundos desde que empezó la animación; `dir` la fila 0–7.
   */
  show(anims: readonly AnimId[], dir: number, t: number, screenAngle: number): void {
    let tex: Texture | null = null;
    let anim: AnimId | undefined;
    for (const a of anims) {
      tex = this.lib.frame(this.def.id, a, dir, t);
      if (tex) {
        anim = a;
        break;
      }
    }
    const meta = anim ? this.lib.meta(this.def.id, anim) : null;
    if (tex && meta) {
      this.sprite.texture = tex;
      this.sprite.anchor.set(meta.pivot[0] / meta.cell[0], meta.pivot[1] / meta.cell[1]);
      this.sprite.scale.set(this.cellScale);
      this.sprite.visible = true;
      this.placeholder.visible = false;
    } else {
      this.sprite.visible = false;
      this.placeholder.visible = true;
      this.placeholder.setFacing(screenAngle);
    }
  }
}
