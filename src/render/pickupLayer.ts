// Dibujos de los objetos del mapa: gemas, recogibles, cofres, barriles, petardos y la baliza del objetivo.
// Sprites reutilizados dentro de la capa de actores (ordenados por profundidad); los halos siguen en FxLayer.
import { Assets, Container, Sprite, type Texture } from 'pixi.js';
import { PICKUP_ART } from '../config/render';
import type { World } from '../engine/types';
import { isoX, isoY } from './iso';

interface ArtInfo {
  file: string;
  /** Base del cuerpo como fracción de la altura. */
  ay: number;
  /** Ancho del cuerpo en px de la textura. */
  bw: number;
}

interface Art {
  tex: Texture;
  ay: number;
  bw: number;
}

export type PickupArt = ReadonlyMap<string, Art>;

/** Carga `pickups.json` y sus texturas; las que fallen se saltan (ese objeto sigue con su placeholder). */
export async function loadPickupArt(): Promise<PickupArt> {
  const index = await Assets.load<Record<string, ArtInfo>>(PICKUP_ART.index);
  const out = new Map<string, Art>();
  await Promise.all(
    Object.entries(index).map(async ([name, a]) => {
      try {
        out.set(name, { tex: await Assets.load<Texture>(PICKUP_ART.dir + a.file), ay: a.ay, bw: a.bw });
      } catch {
        // Sin textura: FxLayer dibuja el placeholder.
      }
    }),
  );
  return out;
}

export class PickupLayer {
  private readonly pool: Sprite[] = [];
  private used = 0;

  constructor(
    private readonly parent: Container,
    readonly art: PickupArt,
  ) {}

  /** Dibuja `name` apoyado en (x, y) del mundo con su cuerpo de ancho `width`; sin dibujo no pone nada. */
  private put(name: string, x: number, y: number, width: number, lift = 0): void {
    const a = this.art.get(name);
    if (!a) return;
    let s = this.pool[this.used];
    if (!s) {
      s = new Sprite();
      this.pool.push(s);
      this.parent.addChild(s);
    }
    this.used++;
    if (s.texture !== a.tex) s.texture = a.tex;
    s.anchor.set(0.5, a.ay);
    s.scale.set(width / a.bw);
    s.position.set(isoX(x, y), isoY(x, y) - lift);
    s.zIndex = x + y;
    s.visible = true;
  }

  sync(w: World): void {
    this.used = 0;
    const t = w.time;
    const W = PICKUP_ART.w;
    for (let i = 0; i < w.pickups.count; i++) {
      const k = w.pickups.items[i]!;
      const name = k.kind === 'gem' ? (k.val >= 25 ? 'gem25' : k.val >= 5 ? 'gem5' : 'gem1') : k.kind;
      const lift = PICKUP_ART.bob.includes(name) ? 2 + Math.sin(t * 4 + k.x) * 2 : 0;
      this.put(name, k.x, k.y, (W[name] ?? 3) * k.r, lift);
    }
    for (let i = 0; i < w.barrels.count; i++) {
      const b = w.barrels.items[i]!;
      const lit = b.fuse >= 0;
      // Con la mecha encendida tiembla.
      const jx = lit ? Math.sin(t * 70) * 1.5 : 0;
      this.put(lit ? 'barrel_lit' : 'barrel', b.x + jx, b.y - jx, (lit ? W.barrel_lit! : W.barrel!) * b.r);
    }
    for (let i = 0; i < w.mines.count; i++) {
      const m = w.mines.items[i]!;
      this.put('mine', m.x, m.y, PICKUP_ART.fixed.mine!);
    }
    if (w.objective) this.put('beacon', w.objective.x, w.objective.y, PICKUP_ART.fixed.beacon!);
    for (let i = this.used; i < this.pool.length; i++) this.pool[i]!.visible = false;
  }
}
