// Mapa de la pausa: lo que hay alrededor del jugador a pantalla completa, con el nombre de cada sitio. La partida está
// parada, así que se pinta una vez (y al cambiar de tamaño) sobre lo que devuelve `scanArea`.
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MAP, RADAR } from '../../../config/render';
import { buildingState, scanArea, type AreaScan } from '../../../engine/obstacles';
import type { World } from '../../../engine/types';
import { isoX, isoY } from '../../../engine/view';
import { chestArtReady, drawArrow, drawChest, drawEvent, drawZone, eventColor, isChestKind } from './mapArt';
import { MapKey } from './MapKey';
import { useTapGuard } from './tapGuard';

type Label = (key: string) => string;

interface Props {
  world: World;
  onClose: () => void;
}

export function MapView({ world, onClose }: Props) {
  const { t } = useTranslation();
  const ref = useRef<HTMLCanvasElement>(null);
  const guard = useTapGuard(true);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const scan = scanArea(world, MAP.cells);
    const draw = (): void => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w === 0 || h === 0) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintMap(ctx, w, h, world, scan, t);
    };
    draw();
    let live = true;
    void chestArtReady().then(() => {
      if (live) draw();
    });
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => {
      live = false;
      ro.disconnect();
    };
  }, [world, t]);

  return (
    <div className="overlay overlay--map" role="dialog" aria-modal="true" aria-label={t('map.title')}>
      <header className="mapview__head">
        <h2 className="overlay__title">{t('map.title')}</h2>
        <button className="btn btn--primary" autoFocus onClick={() => guard(onClose)}>
          {t('map.close')}
        </button>
      </header>
      <canvas ref={ref} className="mapview__canvas" aria-label={t('map.title')} />
      <MapKey full className="mapview__key" />
    </div>
  );
}

interface Box {
  x: number;
  y: number;
  half: number;
}

/** Rótulo bajo un marcador, dentro del mapa y, si pisa a otro ya puesto, debajo de él. */
function text(
  ctx: CanvasRenderingContext2D,
  placed: Box[],
  s: string,
  x: number,
  y0: number,
  W: number,
  color: string,
): void {
  ctx.font = `bold ${MAP.font}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const half = ctx.measureText(s).width / 2 + 4;
  const tx = Math.max(half, Math.min(W - half, x));
  const line = MAP.font + 3;
  let y = y0;
  for (const b of placed) if (Math.abs(b.x - tx) < b.half + half && Math.abs(b.y - y) < line) y = b.y + line;
  placed.push({ x: tx, y, half });
  ctx.lineWidth = 3;
  ctx.strokeStyle = MAP.bg;
  ctx.strokeText(s, tx, y);
  ctx.fillStyle = color;
  ctx.fillText(s, tx, y);
}

function paintMap(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  w: World,
  scan: AreaScan,
  t: Label,
): void {
  const cx = W / 2;
  const cy = H / 2;
  const k = cy / MAP.range;
  const p = w.player;
  const px = (x: number, y: number): number => cx + isoX(x - p.x, y - p.y) * k;
  const py = (x: number, y: number): number => cy + isoY(x - p.x, y - p.y) * k;
  const inside = (x: number, y: number): boolean => x >= 0 && x <= W && y >= 0 && y <= H;
  // El jugador ocupa su sitio: ningún rótulo debajo de él.
  const labels: Box[] = [{ x: cx, y: cy - 6, half: 12 }];
  /** Lo que queda fuera sale como flecha en el borde; devuelve dónde. */
  const edge = (x: number, y: number): { x: number; y: number; ang: number } => {
    const ang = Math.atan2(y - cy, x - cx);
    const m = MAP.margin;
    const f = Math.min((cx - m) / Math.abs(x - cx || 1), (cy - m) / Math.abs(y - cy || 1));
    return { x: cx + (x - cx) * f, y: cy + (y - cy) * f, ang };
  };

  ctx.fillStyle = MAP.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = RADAR.dim;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  const step = MAP.grid * k;
  for (let x = cx % step; x < W; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
  }
  for (let y = cy % step; y < H; y += step) {
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Terreno: ácido y objetos sueltos.
  ctx.fillStyle = RADAR.lake;
  for (const l of scan.lakes) {
    ctx.beginPath();
    ctx.ellipse(
      px(l.x, l.y),
      py(l.x, l.y),
      Math.max(3, l.r * k),
      Math.max(1.5, (l.r * k) / 2),
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.fillStyle = MAP.object;
  for (const o of scan.objects) ctx.fillRect(px(o.x, o.y) - 2, py(o.x, o.y) - 2, 4, 4);

  // Lo que se ve en pantalla durante la partida.
  ctx.strokeStyle = RADAR.dim;
  ctx.strokeRect(cx - w.view.halfW * k, cy - w.view.halfH * k, w.view.halfW * 2 * k, w.view.halfH * 2 * k);

  // Enemigos.
  for (let i = 0; i < w.enemies.count; i++) {
    const e = w.enemies.items[i]!;
    const x = px(e.x, e.y);
    const y = py(e.x, e.y);
    ctx.fillStyle = MAP.enemy;
    if (!inside(x, y)) {
      if (e.boss) {
        const a = edge(x, y);
        drawArrow(ctx, a.x, a.y, a.ang, 1.5);
      }
      continue;
    }
    ctx.beginPath();
    ctx.arc(x, y, e.boss ? 8 : e.elite ? 4.5 : 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = RADAR.barrel;
  for (let i = 0; i < w.barrels.count; i++) {
    const b = w.barrels.items[i]!;
    ctx.fillRect(px(b.x, b.y) - 2.5, py(b.x, b.y) - 2.5, 5, 5);
  }

  // Zonas: las pendientes que no caben llevan flecha si están a tiro; las lejanas llenarían los bordes.
  for (const b of scan.buildings) {
    const x = px(b.x, b.y);
    const y = py(b.x, b.y);
    const state = buildingState(w, b);
    if (!inside(x, y)) {
      if (state === 'done' || Math.hypot(x - cx, y - cy) / k > MAP.arrowRange) continue;
      const a = edge(x, y);
      ctx.fillStyle = RADAR.buildings[b.kind];
      drawArrow(ctx, a.x, a.y, a.ang, 1.2);
      continue;
    }
    drawZone(ctx, x, y, MAP.zone, b.kind, state, 0.5);
    const name = t(`map.zones.${b.kind}`);
    text(ctx, labels, state === 'done' ? `${name} ✓` : name, x, y + MAP.zone + 4, W, RADAR.buildings[b.kind]);
  }

  // Cofres y recogibles.
  for (let i = 0; i < w.pickups.count; i++) {
    const it = w.pickups.items[i]!;
    const chest = isChestKind(it.kind);
    if (!chest && !(it.kind in RADAR.kinds)) continue;
    const x = px(it.x, it.y);
    const y = py(it.x, it.y);
    const color = RADAR.kinds[it.kind as keyof typeof RADAR.kinds];
    if (!inside(x, y)) {
      if (!chest || it.kind === 'crate') continue;
      const e = edge(x, y);
      ctx.fillStyle = color;
      drawArrow(ctx, e.x, e.y, e.ang, 1.3);
      continue;
    }
    if (isChestKind(it.kind)) drawChest(ctx, x, y, MAP.chest, it.kind);
    else {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    text(ctx, labels, t(`pickups.${it.kind}`), x, y + (chest ? MAP.chest / 2 : 6) + 2, W, color);
  }

  // Evento: su zona real y la exclamación; si queda fuera, una flecha grande.
  const ob = w.objective;
  if (ob) {
    const x = px(ob.x, ob.y);
    const y = py(ob.x, ob.y);
    const color = eventColor(ob.kind);
    if (inside(x, y)) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y, ob.r * k, (ob.r * k) / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      drawEvent(ctx, x, y, MAP.event, ob.kind, 0.5);
      text(ctx, labels, t(`map.events.${ob.kind}`), x, y + MAP.event + 5, W, color);
    } else {
      const e = edge(x, y);
      ctx.fillStyle = color;
      drawArrow(ctx, e.x, e.y, e.ang, 1.8);
      text(ctx, labels, t(`map.events.${ob.kind}`), e.x, e.y + 14, W, color);
    }
  }

  // Bomba del evento «Tú mismo, otra vez».
  const mb = w.mirror;
  if (mb.phase === 1) {
    const x = px(mb.x, mb.y);
    const y = py(mb.x, mb.y);
    const color = eventColor('purge');
    if (inside(x, y)) {
      drawEvent(ctx, x, y, MAP.event, 'purge', 0.5);
      text(ctx, labels, t('map.events.mirror'), x, y + MAP.event + 5, W, color);
    } else {
      const e = edge(x, y);
      ctx.fillStyle = color;
      drawArrow(ctx, e.x, e.y, e.ang, 1.8);
      text(ctx, labels, t('map.events.mirror'), e.x, e.y + 14, W, color);
    }
  }

  // El jugador.
  const face = Math.atan2(isoY(p.facingX, p.facingY), isoX(p.facingX, p.facingY));
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(face + Math.PI / 2);
  ctx.fillStyle = RADAR.phosphor;
  ctx.strokeStyle = MAP.bg;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -11);
  ctx.lineTo(9, 9);
  ctx.lineTo(-9, 9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
