// Dibujos de los efectos (tools/slice_fx.py → `assets/fx/`): tiras de frames cargadas como texturas y sprites
// reutilizados cada frame, igual que PickupLayer. FxLayer los pide y, si falta una tira, dibuja su placeholder.
import { Assets, Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { FX_ART } from '../config/render';

interface StripInfo {
  file: string;
  frames: number;
  w: number;
  h: number;
}

export interface FxStrip {
  readonly frames: readonly Texture[];
  readonly w: number;
  readonly h: number;
}

export type FxArt = ReadonlyMap<string, FxStrip>;

/** Carga `fx.json` y sus tiras; las que fallen se saltan (ese efecto sigue con su placeholder). */
export async function loadFxArt(): Promise<FxArt> {
  const index = await Assets.load<Record<string, StripInfo>>(FX_ART.index);
  const out = new Map<string, FxStrip>();
  await Promise.all(
    Object.entries(index).map(async ([name, s]) => {
      try {
        const tex = await Assets.load<Texture>(FX_ART.dir + s.file);
        const frames: Texture[] = [];
        for (let i = 0; i < s.frames; i++)
          frames.push(new Texture({ source: tex.source, frame: new Rectangle(i * s.w, 0, s.w, s.h) }));
        out.set(name, { frames, w: s.w, h: s.h });
      } catch {
        // Sin tira: FxLayer dibuja el placeholder.
      }
    }),
  );
  return out;
}

export interface PutOpts {
  /** Punto de apoyo como fracción del frame (por defecto, el centro). */
  ax?: number;
  ay?: number;
  rot?: number;
  alpha?: number;
  tint?: number;
  /** Mezcla aditiva (brillos). */
  add?: boolean;
  /** Aplasta el frame a 2:1 (decals planos del suelo). */
  flat?: boolean;
  /** Voltea en horizontal. */
  flip?: boolean;
}

/** Sprites de efectos de una capa (suelo o aire), reutilizados: `begin`, varios `put` y `end` por frame. */
export class FxSprites {
  readonly layer = new Container();
  private readonly pool: Sprite[] = [];
  private used = 0;

  constructor(readonly art: FxArt) {}

  has(name: string): boolean {
    return this.art.has(name);
  }

  /** Frame de una animación en bucle a `fps`. */
  loop(name: string, t: number, fps: number): number {
    const n = this.art.get(name)?.frames.length ?? 1;
    return Math.floor(t * fps) % n;
  }

  /** Frame de una animación que se reproduce una vez, con `f` de 0 a 1. */
  once(name: string, f: number): number {
    const n = this.art.get(name)?.frames.length ?? 1;
    return Math.max(0, Math.min(n - 1, Math.floor(f * n)));
  }

  begin(): void {
    this.used = 0;
  }

  end(): void {
    for (let i = this.used; i < this.pool.length; i++) this.pool[i]!.visible = false;
  }

  /** Pone el frame `frame` de `name` en (sx, sy) de pantalla isométrica con ancho `width`; sin tira no pone nada. */
  put(name: string, frame: number, sx: number, sy: number, width: number, o: PutOpts = {}): void {
    const strip = this.art.get(name);
    if (!strip || width <= 0) return;
    let s = this.pool[this.used];
    if (!s) {
      s = new Sprite();
      this.pool.push(s);
      this.layer.addChild(s);
    }
    this.used++;
    const tex = strip.frames[frame] ?? strip.frames[0]!;
    if (s.texture !== tex) s.texture = tex;
    s.anchor.set(o.ax ?? 0.5, o.ay ?? 0.5);
    const k = width / strip.w;
    s.scale.set(o.flip ? -k : k, o.flat ? width / 2 / strip.h : k);
    s.position.set(sx, sy);
    s.rotation = o.rot ?? 0;
    s.alpha = o.alpha ?? 1;
    s.tint = o.tint ?? 0xffffff;
    s.blendMode = o.add ? 'add' : 'normal';
    s.visible = true;
  }
}
