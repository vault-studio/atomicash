// Cargador de sprite sheets (biblia de arte §11.2): lee `assets/manifest.json`, carga cada PNG + JSON
// y corta las texturas por fila (dirección) y columna (frame). Si algo falta, `frame()` devuelve null
// y el render dibuja el placeholder sin fallar.
import { Assets, Rectangle, Texture } from 'pixi.js';
import { sheetKey } from '../config/entities';
import { SPRITES } from '../config/render';
import { frameIndex, parseSpriteMeta, rowIndex, type SpriteMeta } from './spriteMeta';

interface Sheet {
  meta: SpriteMeta;
  base: Texture;
  /** frames[fila][columna], cortados bajo demanda. */
  frames: (Texture | undefined)[][];
}

export class SpriteLibrary {
  private readonly sheets = new Map<string, Sheet>();
  private loading: Promise<number> | null = null;

  constructor(private readonly baseUrl: string = import.meta.env.BASE_URL + SPRITES.assetBase) {}

  get count(): number {
    return this.sheets.size;
  }

  has(id: string, anim: string): boolean {
    return this.sheets.has(sheetKey(id, anim));
  }

  meta(id: string, anim: string): SpriteMeta | null {
    return this.sheets.get(sheetKey(id, anim))?.meta ?? null;
  }

  /** Carga todas las hojas del manifiesto una sola vez. Devuelve cuántas hay cargadas. */
  load(): Promise<number> {
    this.loading ??= this.loadManifest();
    return this.loading;
  }

  private async loadManifest(): Promise<number> {
    let list: unknown;
    try {
      const res = await fetch(this.baseUrl + SPRITES.manifest, { cache: 'no-store' });
      if (!res.ok) return 0;
      list = await res.json();
    } catch {
      return 0;
    }
    if (!Array.isArray(list)) return 0;
    await Promise.all(
      list.filter((p): p is string => typeof p === 'string').map((path) => this.loadSheet(path)),
    );
    return this.sheets.size;
  }

  private async loadSheet(path: string): Promise<void> {
    const url = this.baseUrl + 'sprites/' + path;
    try {
      const [raw, base] = await Promise.all([
        fetch(url + '.json').then((r) => (r.ok ? (r.json() as Promise<unknown>) : null)),
        Assets.load<Texture>(url + '.png'),
      ]);
      const meta = parseSpriteMeta(raw, base.width);
      if (!meta) {
        console.warn(`[sprites] JSON inválido: ${path}`);
        return;
      }
      this.sheets.set(sheetKey(meta.id, meta.anim), { meta, base, frames: [] });
    } catch (err) {
      console.warn(`[sprites] no se pudo cargar ${path}`, err);
    }
  }

  /** Textura del frame para `t` segundos de animación mirando en `dir` (0–7). null si no hay hoja. */
  frame(id: string, anim: string, dir: number, t: number): Texture | null {
    const sh = this.sheets.get(sheetKey(id, anim));
    if (!sh) return null;
    const row = rowIndex(sh.meta, dir);
    const col = frameIndex(sh.meta, t);
    const rowArr = (sh.frames[row] ??= []);
    let tex = rowArr[col];
    if (!tex) {
      const [cw, ch] = sh.meta.cell;
      const x = col * cw;
      const y = row * ch;
      // Una hoja más pequeña de lo que dice su JSON no debe romper el juego.
      if (x + cw > sh.base.width || y + ch > sh.base.height) return null;
      tex = new Texture({ source: sh.base.source, frame: new Rectangle(x, y, cw, ch) });
      rowArr[col] = tex;
    }
    return tex;
  }
}

/** Biblioteca compartida por toda la app. */
export const sprites = new SpriteLibrary();
