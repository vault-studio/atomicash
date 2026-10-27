// Efectos que el motor deja para el render y la UI: textos, avisos, explosiones y rayos.
// Todos usan pools con tope; si se llena, el efecto se descarta (no afecta a la simulación).
import { FX } from '../config/run';
import { SFX, sfx } from './sfx';
import { BEAM_POINTS, type Beam, type Boom, type FxKind, type FxText, type World } from './types';

export const createText = (): FxText => ({ kind: 'dmg', x: 0, y: 0, value: 0, key: '', life: 0 });
export const createBoom = (): Boom => ({ x: 0, y: 0, r: 0, life: 0, max: 0, color: 0 });
export const createBeam = (): Beam => ({
  pts: new Float32Array(BEAM_POINTS * 2),
  n: 0,
  life: 0,
  max: 0,
  color: 0,
});

export function textFx(w: World, kind: FxKind, x: number, y: number, value: number, key = ''): void {
  if (w.texts.count >= FX.maxTexts) return;
  const t = w.texts.acquire();
  t.kind = kind;
  t.x = x;
  t.y = y;
  t.value = value;
  t.key = key;
  t.life = FX.textLife;
}

/** Aviso grande; raro (eventos, jefes), así que puede reservar memoria. */
export function banner(w: World, key: string, params: Readonly<Record<string, string>> = {}): void {
  w.banners.push({ key, params, life: FX.bannerLife });
}

export function boom(w: World, x: number, y: number, r: number, life: number, color: number): void {
  sfx(w, SFX.boom);
  if (w.booms.count >= FX.maxBooms) return;
  const b = w.booms.acquire();
  b.x = x;
  b.y = y;
  b.r = r;
  b.life = b.max = life;
  b.color = color;
}

/** Empieza un rayo en (x, y); añade puntos con `beamPoint`. Devuelve null si no caben más. */
export function beamStart(w: World, x: number, y: number, life: number, color: number): Beam | null {
  sfx(w, SFX.zap);
  if (w.beams.count >= FX.maxBeams) return null;
  const b = w.beams.acquire();
  b.pts[0] = x;
  b.pts[1] = y;
  b.n = 1;
  b.life = b.max = life;
  b.color = color;
  return b;
}

export function beamPoint(b: Beam | null, x: number, y: number): void {
  if (!b || b.n >= BEAM_POINTS) return;
  b.pts[b.n * 2] = x;
  b.pts[b.n * 2 + 1] = y;
  b.n++;
}

export function addShake(w: World, amount: number, max: number = FX.shakeMax): void {
  w.shake = Math.min(max, w.shake + amount);
}

/** Envejece los efectos y retira los terminados. */
export function updateFx(w: World, dt: number): void {
  for (let i = w.texts.count - 1; i >= 0; i--) {
    const t = w.texts.items[i]!;
    t.life -= dt;
    if (t.life <= 0) w.texts.releaseAt(i);
  }
  for (let i = w.booms.count - 1; i >= 0; i--) {
    const b = w.booms.items[i]!;
    b.life -= dt;
    if (b.life <= 0) w.booms.releaseAt(i);
  }
  for (let i = w.beams.count - 1; i >= 0; i--) {
    const b = w.beams.items[i]!;
    b.life -= dt;
    if (b.life <= 0) w.beams.releaseAt(i);
  }
  for (let i = w.banners.length - 1; i >= 0; i--) {
    const b = w.banners[i]!;
    b.life -= dt;
    if (b.life <= 0) w.banners.splice(i, 1);
  }
  const ct = w.time - FX.corpseTime;
  for (let i = w.corpses.count - 1; i >= 0; i--) if (w.corpses.items[i]!.t < ct) w.corpses.releaseAt(i);
  w.shake *= Math.exp(-FX.shakeDecay * dt);
}
