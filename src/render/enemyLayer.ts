// Vistas de enemigos reutilizadas por posición en el pool del motor.
// Cada vista se crea una vez por hueco y solo se rehace si en ese hueco aparece otro tipo de enemigo.
import type { Container } from 'pixi.js';
import { ENTITIES } from '../config/entities';
import type { Enemy, World } from '../engine/types';
import { ActorView } from './actor';
import { dirIndex, isoX, isoY } from './iso';
import type { SpriteLibrary } from './sprites';

const MOVE_ANIMS = ['move', 'idle'] as const;
const IDLE_ANIMS = ['idle', 'move'] as const;

export class EnemyLayer {
  private readonly views: ActorView[] = [];

  constructor(
    private readonly parent: Container,
    private readonly lib: SpriteLibrary,
  ) {}

  sync(w: World, alpha: number): void {
    const items = w.enemies.items;
    const n = w.enemies.count;
    for (let i = 0; i < n; i++) {
      const e = items[i] as Enemy;
      let v = this.views[i];
      if (!v || v.entityId !== e.type) {
        v?.destroy({ children: true });
        v = new ActorView(ENTITIES[e.type], this.lib, false);
        this.views[i] = v;
        this.parent.addChild(v);
      }
      const x = e.prevX + (e.x - e.prevX) * alpha;
      const y = e.prevY + (e.y - e.prevY) * alpha;
      v.visible = true;
      v.position.set(isoX(x, y), isoY(x, y));
      v.zIndex = x + y;
      v.show(e.moving ? MOVE_ANIMS : IDLE_ANIMS, dirIndex(e.facingX, e.facingY), w.time - e.born, 0);
    }
    for (let i = n; i < this.views.length; i++) {
      const v = this.views[i];
      if (v) v.visible = false;
    }
  }
}
