// Restos de robots: el sprite de cada uno se parte en trozos irregulares que salen volando y se quedan en el suelo.
// DECISIÓN: los trozos se recortan del propio sprite al empezar la partida, así un robot nuevo no necesita arte aparte,
// y las piezas salen de una sola dirección de la hoja: la explosión tapa el cambio.
import { Container, Sprite } from 'pixi.js';
import { ELITES, ENEMY_STATS, type EnemyStats } from '../../config/enemies';
import { type EntityId } from '../../config/entities';
import type { World } from '../../engine/types';
import { flyLift } from '../fx';
import { isoX, isoY } from '../iso';
import type { SpriteLibrary } from '../sprites';
import { pieceAt, type PieceState } from './wreckMath';
import { type PieceSet, W, colorPieces, sets, shade, spritePieces } from './pieces';

export class WreckLayer {
  /** Lo que ya ha caído (bajo los actores) y lo que aún vuela (encima). */
  readonly ground = new Container();
  readonly air = new Container();
  private readonly sprites: Sprite[] = [];
  private readonly state: PieceState = { x: 0, y: 0, z: 0, rot: 0, f: 0 };

  /** Recorta aquí todos los robots: hacerlo en la primera baja daría un tirón en plena partida. */
  constructor(private readonly lib: SpriteLibrary) {
    for (const [id, s] of Object.entries(ENEMY_STATS) as [EntityId, EnemyStats][]) if (s.wreck) this.set(id);
  }

  private set(id: EntityId): PieceSet {
    let s = sets.get(id);
    if (!s) {
      s = spritePieces(this.lib, id) ?? colorPieces(id);
      sets.set(id, s);
    }
    return s;
  }

  private sprite(i: number): Sprite {
    let s = this.sprites[i];
    if (!s) {
      s = new Sprite();
      s.anchor.set(0.5);
      this.sprites[i] = s;
    }
    s.visible = true;
    return s;
  }

  sync(w: World): void {
    let n = 0;
    const P = this.state;
    for (let i = 0; i < w.wrecks.count; i++) {
      const k = w.wrecks.items[i]!;
      const age = w.time - k.t;
      if (age < W.delay) continue;
      const set = this.set(k.sprite);
      const size = k.elite ? ELITES.scale : 1;
      const width = set.width * size;
      const lift = k.flying ? flyLift(k.sprite) : 0;
      const alpha = Math.min(1, (k.until - w.time) / W.fade);
      const dark = 1 - (1 - W.char) * Math.min(1, age / W.charTime);
      const sx = isoX(k.x, k.y);
      const sy = isoY(k.x, k.y);
      for (let j = 0; j < set.pieces.length; j++) {
        const p = set.pieces[j]!;
        pieceAt(P, k.seed, j, p.ox * size, p.oy * size, p.frac, width, lift, age, W.motion);
        const s = this.sprite(n++);
        s.texture = p.tex;
        s.scale.set(p.scale * size * (1 - (1 - W.restScale) * P.f));
        s.position.set(sx + P.x, sy + P.y - P.z);
        s.rotation = P.rot;
        s.alpha = alpha;
        s.tint = shade(p.tint, dark);
        const layer = P.f < 1 ? this.air : this.ground;
        if (s.parent !== layer) layer.addChild(s);
      }
    }
    for (let i = n; i < this.sprites.length; i++) this.sprites[i]!.visible = false;
  }
}
