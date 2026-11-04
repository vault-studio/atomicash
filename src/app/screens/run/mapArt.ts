// Marcadores del radar y del mapa de la pausa: cada tipo de sitio tiene su forma para distinguirlo de un vistazo.
// Zona con enemigos: rombo con una X. Suministros: caja. Cofres: su dibujo. Evento: anillo con «!».
import { RADAR } from '../../../config/render';
import type { BuildingKind } from '../../../config/props';
import type { BuildingState } from '../../../engine/obstacles';
import type { ObjectiveKind } from '../../../config/modes';
import { pickupIcon } from '../../icons';

export type ChestKind = 'chest' | 'crate' | 'cache';
export const CHEST_KINDS: readonly ChestKind[] = ['chest', 'crate', 'cache'];
export const isChestKind = (k: string): k is ChestKind => (CHEST_KINDS as readonly string[]).includes(k);

const images = new Map<ChestKind, HTMLImageElement>();

function chestImage(kind: ChestKind): HTMLImageElement {
  let img = images.get(kind);
  if (!img) {
    img = new Image();
    img.src = pickupIcon(kind);
    images.set(kind, img);
  }
  return img;
}

/** Espera a los dibujos de los cofres; los que fallen se quedan en un cuadrado de color. */
export function chestArtReady(): Promise<void> {
  return Promise.all(
    CHEST_KINDS.map((k) =>
      chestImage(k)
        .decode()
        .catch(() => undefined),
    ),
  ).then(() => undefined);
}

export function drawChest(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  kind: ChestKind,
): void {
  const img = chestImage(kind);
  const color = RADAR.kinds[kind];
  // Medalla: el dibujo es oscuro y a este tamaño se perdería sobre el fondo.
  ctx.fillStyle = RADAR.bg;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  const art = size * 0.78;
  if (img.complete && img.naturalWidth > 0) {
    const k = art / Math.max(img.naturalWidth, img.naturalHeight);
    const w = img.naturalWidth * k;
    const h = img.naturalHeight * k;
    ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
  } else {
    ctx.fillStyle = color;
    ctx.fillRect(x - art / 3, y - art / 3, (art * 2) / 3, (art * 2) / 3);
  }
}

function zonePath(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, supply: boolean): void {
  ctx.beginPath();
  if (supply) {
    ctx.rect(x - s * 0.8, y - s * 0.8, s * 1.6, s * 1.6);
    return;
  }
  ctx.moveTo(x, y - s);
  ctx.lineTo(x + s, y);
  ctx.lineTo(x, y + s);
  ctx.lineTo(x - s, y);
  ctx.closePath();
}

/** Edificio: relleno si queda algo por hacer y hueco si ya está hecho; un aro que late si se está luchando allí. */
export function drawZone(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  kind: BuildingKind,
  state: BuildingState,
  pulse: number,
): void {
  const color = RADAR.buildings[kind];
  const supply = kind === 'supply';
  zonePath(ctx, x, y, s, supply);
  if (state === 'done') {
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
    return;
  }
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = RADAR.ink;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const g = s * 0.42;
  ctx.lineWidth = Math.max(1.5, s * 0.22);
  ctx.beginPath();
  if (supply) {
    // Las cinchas de la caja.
    ctx.moveTo(x - s * 0.8, y);
    ctx.lineTo(x + s * 0.8, y);
    ctx.moveTo(x, y - s * 0.8);
    ctx.lineTo(x, y + s * 0.8);
  } else {
    ctx.moveTo(x - g, y - g);
    ctx.lineTo(x + g, y + g);
    ctx.moveTo(x + g, y - g);
    ctx.lineTo(x - g, y + g);
  }
  ctx.stroke();
  if (state === 'active') {
    ctx.strokeStyle = RADAR.fight;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, s * (1.25 + 0.3 * pulse), 0, Math.PI * 2);
    ctx.stroke();
  }
}

export const eventColor = (kind: ObjectiveKind): string =>
  kind === 'purge' ? RADAR.objectivePurge : RADAR.objective;

/** Evento en el que hay que entrar: anillo que late con una exclamación dentro. */
export function drawEvent(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  kind: ObjectiveKind,
  pulse: number,
): void {
  const color = eventColor(kind);
  ctx.strokeStyle = color;
  ctx.fillStyle = RADAR.bg;
  ctx.lineWidth = 2.5;
  ctx.shadowColor = color;
  ctx.shadowBlur = r * 0.7;
  ctx.beginPath();
  ctx.arc(x, y, r * (0.92 + 0.14 * pulse), 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = color;
  ctx.font = `bold ${Math.round(r * 1.5)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', x, y + r * 0.08);
}

/** Flecha que apunta en `ang`, para lo que queda fuera. */
export function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, scale = 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -6);
  ctx.lineTo(-2, 0);
  ctx.lineTo(-5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
