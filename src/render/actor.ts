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
    this.addChild(this.sprite, this.placeholder);
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
