// Vistas de enemigos y cadáveres reutilizadas por posición en el pool del motor.
// Cada vista se crea una vez por hueco y solo se rehace si en ese hueco aparece otro sprite.
import type { Container } from 'pixi.js';
import { ENTITIES, type AnimId, type EntityId } from '../config/entities';
import { AI, ELITES } from '../config/enemies';
import { RAGE_VIEW, RUN_COLORS } from '../config/render';
import { JUICE } from '../config/run';
import { spriteIdFor } from '../engine/systems/combat';
import type { Enemy, World } from '../engine/types';
import { ActorView } from './actor';
import { flyLift } from './fxLayer';
import { dirIndex, isoX, isoY } from './iso';
import type { SpriteMeta } from './spriteMeta';
import type { SpriteLibrary } from './sprites';

/** Altura del Coloso en pleno salto: un arco que sube y baja durante el aviso. */
const leapLift = (e: Enemy): number =>
  e.type === 'coloso' && e.alt && e.stun > 0
    ? Math.sin(Math.PI * (1 - e.stun / AI.coloso.stompWarn)) * AI.coloso.jumpH
    : 0;

// Algunas hojas llaman `run` a lo que el juego llama `move` (saqueador, Rey Rata).
const MOVE_ANIMS = ['move', 'run', 'idle'] as const;
const IDLE_ANIMS = ['idle', 'move', 'run'] as const;
const DEATH_ANIMS = ['death'] as const;
const VICTORY_ANIMS = ['victory', 'idle', 'run'] as const;
const ATTACK_ANIMS: Record<string, readonly AnimId[]> = {
  // El tirador trae su disparo como attack_1.
  attack: ['attack', 'attack_1', 'move', 'run', 'idle'],
  attack_1: ['attack_1', 'attack', 'move', 'run', 'idle'],
  attack_2: ['attack_2', 'attack', 'move', 'run', 'idle'],
};
/** Duración del destello de golpe que pone el motor (`hitEnemy`). */
const HIT_FLASH = 0.08;
/** Duración de la animación de ataque si la hoja no existe. */
const ATTACK_FALLBACK = 0.35;

class ViewSlots {
  private readonly views: ActorView[] = [];

  constructor(
    private readonly parent: Container,
    private readonly lib: SpriteLibrary,
  ) {}

  get(i: number, id: EntityId): ActorView {
    let v = this.views[i];
    if (!v || v.entityId !== id) {
      v?.destroy({ children: true });
      v = new ActorView(ENTITIES[id], this.lib, false);
      this.views[i] = v;
      this.parent.addChild(v);
    }
    v.visible = true;
    return v;
  }

  hideFrom(n: number): void {
    for (let i = n; i < this.views.length; i++) {
      const v = this.views[i];
      if (v) v.visible = false;
    }
  }
}

export class EnemyLayer {
  private readonly alive: ViewSlots;
  private readonly dead: ViewSlots;

  constructor(
    parent: Container,
    private readonly lib: SpriteLibrary,
  ) {
    this.alive = new ViewSlots(parent, lib);
    this.dead = new ViewSlots(parent, lib);
  }

  /** Hoja de ataque que se mostrará para `anim` (el tirador pide `attack` pero solo trae `attack_1`). */
  private attackMeta(id: EntityId, anim: string): SpriteMeta | null {
    for (const a of ATTACK_ANIMS[anim]!) {
      if (!a.startsWith('attack')) break;
      const m = this.lib.meta(id, a);
      if (m) return m;
    }
    return null;
  }

  /** `victor` (si lo hay) hace su animación de victoria mirando a cámara, `victorT` s desde que empezó. */
  sync(w: World, alpha: number, victor: Enemy | null = null, victorT = 0): void {
    const items = w.enemies.items;
    const n = w.enemies.count;
    let shown = 0;
    for (let i = 0; i < n; i++) {
      const e = items[i] as Enemy;
      if (e.dead) continue;
      const id = spriteIdFor(e);
      const v = this.alive.get(shown++, id);
      const x = e.prevX + (e.x - e.prevX) * alpha;
      const y = e.prevY + (e.y - e.prevY) * alpha;
      v.position.set(isoX(x, y), isoY(x, y));
      v.scale.set(e.elite ? ELITES.scale : e.rage ? RAGE_VIEW.scale : 1);
      v.zIndex = x + y + (e.flying ? 1e6 : 0);
      const dir = dirIndex(e.facingX, e.facingY);
      const since = w.time - e.lastAtk;
      const atkMeta = this.attackMeta(id, e.atkAnim);
      const atkDur = atkMeta ? atkMeta.frames / atkMeta.fps : ATTACK_FALLBACK;
      if (e === victor) v.show(VICTORY_ANIMS, 0, victorT, 0);
      else if (since < atkDur) v.show(ATTACK_ANIMS[e.atkAnim]!, dir, since, 0);
      // Quieto y sin hoja de reposo (el tirador): se queda apuntando en vez de correr en el sitio.
      else if (!e.moving && atkMeta && !this.lib.meta(id, 'idle'))
        v.show(ATTACK_ANIMS[e.atkAnim]!, dir, 0, 0);
      else v.show(e.moving ? MOVE_ANIMS : IDLE_ANIMS, dir, w.time - e.born, 0);
      // Al final de la furia parpadea (rojo / normal) para que se lea que se le va a pasar.
      const calming =
        e.rage && e.rageT < RAGE_VIEW.warn && Math.floor(w.time * RAGE_VIEW.blinkHz * 2) % 2 === 0;
      const tint =
        e.frozen > 0
          ? RUN_COLORS.frozen
          : e.rage && !calming
            ? RUN_COLORS.rage
            : e.irr
              ? RUN_COLORS.irradiated
              : e.skin !== null
                ? RUN_COLORS.mirror
                : 0xffffff;
      const flash = e.flash > 0 ? Math.min(1, e.flash / HIT_FLASH) : 0;
      v.style(
        e.flying ? flyLift(e.type) : leapLift(e),
        tint,
        1,
        flash,
        e.boss ? JUICE.squash * 0.3 : JUICE.squash,
      );
    }
    this.alive.hideFrom(shown);

    const c = w.corpses;
    for (let i = 0; i < c.count; i++) {
      const k = c.items[i]!;
      const v = this.dead.get(i, k.sprite);
      v.position.set(isoX(k.x, k.y), isoY(k.x, k.y));
      v.zIndex = k.x + k.y - 1;
      const t = w.time - k.t;
      v.show(DEATH_ANIMS, dirIndex(k.facingX, k.facingY), t, 0);
      // Sin hoja de muerte, el placeholder se desvanece.
      const meta = this.lib.meta(k.sprite, 'death');
      const fade = meta ? 1 : Math.max(0, 1 - t * 2.5);
      v.style(
        k.flying ? flyLift(k.sprite) * Math.max(0, 1 - t) : 0,
        k.irr
          ? RUN_COLORS.irradiated
          : ENTITIES[k.sprite].category === 'characters'
            ? RUN_COLORS.mirror
            : 0xffffff,
        fade,
      );
    }
    this.dead.hideFrom(c.count);
  }
}
