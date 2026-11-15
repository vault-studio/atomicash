// Niebla verde de radiación alrededor del personaje.
import { Texture } from 'pixi.js';
import { RAD_FOG } from '../../config/render';
import { GameRenderer, clamp } from './gameRenderer';

/**
 * Niebla verde de radiación con un hueco alrededor del personaje (pies en (x, y) de mundo) que se cierra según sube
 * la RAD. El hueco es un degradado radial (ver `fogTexture`); lo que queda fuera de él, verde liso.
 */
export function drawRadFog(
  r: GameRenderer,
  rad: number,
  x: number,
  y: number,
  k: number,
  time: number,
): void {
  const F = RAD_FOG;
  const f = clamp((rad - F.from) / (F.full - F.from), 0, 1);
  r.fog.visible = f > 0;
  if (f <= 0) return;
  const { width, height } = r.app.screen;
  const ox = r.worldLayer.position.x + x * k;
  const oy = r.worldLayer.position.y + (y - F.lift) * k;
  const far = (Math.hypot(width, height) / 2) * F.start;
  const near = F.hole * k;
  // El hueco se cierra a ritmo constante con la RAD; late un poco cuando ya aprieta.
  const beat = r.reduceMotion ? 0 : 0.04 * f * Math.sin(time * 5);
  const hole = (far + (near - far) * f) * (1 + beat);
  r.fog.alpha = F.maxAlpha * Math.pow(f, 0.7);
  // Bordes en píxeles enteros para que el degradado y el verde liso casen sin rendija ni solape.
  const half = Math.ceil(hole / F.soft);
  const left = Math.round(ox) - half;
  const top = Math.round(oy) - half;
  const size = half * 2;
  const s = r.fogHole;
  s.tint = F.color;
  s.position.set(left, top);
  s.setSize(size, size);
  const g = r.fogEdge;
  g.clear();
  const fill = { color: F.color };
  if (top > 0) g.rect(0, 0, width, top).fill(fill);
  if (top + size < height) g.rect(0, top + size, width, height - top - size).fill(fill);
  if (left > 0) g.rect(0, top, left, size).fill(fill);
  if (left + size < width) g.rect(left + size, top, width - left - size, size).fill(fill);
}

let fogTex: Texture | null = null;

/**
 * Degradado radial blanco (se tiñe con el sprite): transparente hasta `RAD_FOG.soft` del radio y opaco del todo en el
 * borde y las esquinas, con una subida suave para que parezca niebla.
 */
export function fogTexture(): Texture {
  if (fogTex) return fogTex;
  const n = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = n;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  const a = RAD_FOG.soft;
  g.addColorStop(0, 'rgba(255,255,255,0)');
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const e = t * t * (3 - 2 * t);
    g.addColorStop(a + (1 - a) * t, `rgba(255,255,255,${e})`);
  }
  // Fuera del radio el degradado se queda en su último color: las esquinas salen opacas.
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, n, n);
  fogTex = Texture.from(canvas);
  return fogTex;
}
