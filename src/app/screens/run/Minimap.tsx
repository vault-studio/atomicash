// Radar del HUD: lee el mundo cada frame (sin tocarlo) y pinta en un canvas propio lo que hay alrededor del jugador,
// cada tipo de sitio con su marcador (mapArt.ts). Lo que queda fuera del alcance sale como flecha en el borde, apuntando
// hacia donde está. Estética de pantalla de fósforo: anillos, cruz y barrido.
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { RADAR } from '../../../config/render';
import type { PickupKind, World } from '../../../engine/types';
import { buildingState } from '../../../engine/obstacles';
import { isoX, isoY } from '../../../engine/view';
import { drawArrow, drawChest, drawEvent, drawZone, eventColor, isChestKind } from './mapArt';
import { MapKey } from './MapKey';

type RadarKind = keyof typeof RADAR.kinds;
const isRadarKind = (k: PickupKind): k is RadarKind => k in RADAR.kinds;

interface Props {
  world: World;
  onOpen: () => void;
}

export function Minimap({ world, onOpen }: Props) {
  const { t } = useTranslation();
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let raf = 0;
    const draw = (now: number): void => {
      raf = requestAnimationFrame(draw);
      const css = canvas.clientWidth;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const px = Math.round(css * dpr);
      if (canvas.width !== px) {
        canvas.width = px;
        canvas.height = px;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint(ctx, css, world, now / 1000);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [world]);

  return (
    <div className="radar">
      {/* Al pulsar, no al soltar: con un dedo en el joystick el navegador no genera el clic del otro dedo. */}
      <button
        className="radar__open"
        aria-label={t('run.openMap')}
        onPointerDown={(e) => {
          if (e.button === 0) onOpen();
        }}
        onClick={(e) => {
          if (e.detail === 0) onOpen();
        }}
      >
        <canvas ref={ref} className="radar__screen" aria-label={t('run.radar')} />
      </button>
      <MapKey className="radar__legend" />
    </div>
  );
}

function paint(ctx: CanvasRenderingContext2D, size: number, w: World, time: number): void {
  const c = size / 2;
  const R = c - 3;
  const k = (R - 8) / RADAR.range;
  ctx.clearRect(0, 0, size, size);

  // Fondo, anillos, cruz y barrido.
  ctx.fillStyle = RADAR.bg;
  ctx.beginPath();
  ctx.arc(c, c, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = RADAR.dim;
  ctx.lineWidth = 1;
  for (const f of [0.33, 0.66]) {
    ctx.beginPath();
    ctx.arc(c, c, R * f, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(c - R, c);
  ctx.lineTo(c + R, c);
  ctx.moveTo(c, c - R);
  ctx.lineTo(c, c + R);
  ctx.stroke();
  // Lo que se ve en pantalla.
  ctx.strokeRect(c - w.view.halfW * k, c - w.view.halfH * k, w.view.halfW * 2 * k, w.view.halfH * 2 * k);
  const a = (time * RADAR.sweep * Math.PI * 2) % (Math.PI * 2);
  const grad = ctx.createConicGradient(a - 0.7, c, c);
  grad.addColorStop(0, 'rgba(60, 255, 107, 0)');
  grad.addColorStop(0.11, 'rgba(60, 255, 107, 0.22)');
  grad.addColorStop(0.111, 'rgba(60, 255, 107, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(c, c, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = RADAR.phosphor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(c, c, R, 0, Math.PI * 2);
  ctx.stroke();

  const p = w.player;
  const pulse = 0.65 + 0.35 * Math.sin(time * 6);

  // Edificios: dentro, su marcador; fuera, una flecha en el borde.
  for (const b of w.buildings) {
    const dx = b.x - p.x;
    const dy = b.y - p.y;
    const sx = isoX(dx, dy);
    const sy = isoY(dx, dy);
    const state = buildingState(w, b);
    if (Math.hypot(sx, sy) <= RADAR.range)
      drawZone(ctx, c + sx * k, c + sy * k, RADAR.buildingSize, b.kind, state, pulse);
    else if (state !== 'done') {
      const ang = Math.atan2(sy, sx);
      ctx.fillStyle = RADAR.buildings[b.kind];
      ctx.globalAlpha = 0.6;
      drawArrow(ctx, c + Math.cos(ang) * (R - 9), c + Math.sin(ang) * (R - 9), ang);
      ctx.globalAlpha = 1;
    }
  }

  // Cofres y cajas con su dibujo, recogibles con un punto; fuera, una flecha en el borde.
  for (let i = 0; i < w.pickups.count; i++) {
    const it = w.pickups.items[i]!;
    if (!isRadarKind(it.kind)) continue;
    const dx = it.x - p.x;
    const dy = it.y - p.y;
    const sx = isoX(dx, dy);
    const sy = isoY(dx, dy);
    const d = Math.hypot(sx, sy);
    if (d <= RADAR.range && isChestKind(it.kind)) {
      drawChest(ctx, c + sx * k, c + sy * k, RADAR.chestSize, it.kind);
      continue;
    }
    ctx.fillStyle = RADAR.kinds[it.kind];
    ctx.shadowColor = RADAR.kinds[it.kind];
    ctx.shadowBlur = 8;
    if (d <= RADAR.range) {
      ctx.beginPath();
      ctx.arc(c + sx * k, c + sy * k, 4.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const ang = Math.atan2(sy, sx);
      ctx.globalAlpha = pulse;
      drawArrow(ctx, c + Math.cos(ang) * (R - 9), c + Math.sin(ang) * (R - 9), ang);
      ctx.globalAlpha = 1;
    }
    ctx.shadowBlur = 0;
  }

  // Barriles: puntitos rojos (solo los del alcance).
  ctx.fillStyle = RADAR.barrel;
  for (let i = 0; i < w.barrels.count; i++) {
    const b = w.barrels.items[i]!;
    const sx = isoX(b.x - p.x, b.y - p.y);
    const sy = isoY(b.x - p.x, b.y - p.y);
    if (Math.hypot(sx, sy) <= RADAR.range) ctx.fillRect(c + sx * k - 2, c + sy * k - 2, 4, 4);
  }

  // Evento: anillo con exclamación; fuera, una flecha más grande que las demás.
  const ob = w.objective;
  if (ob) {
    const sx = isoX(ob.x - p.x, ob.y - p.y);
    const sy = isoY(ob.x - p.x, ob.y - p.y);
    if (Math.hypot(sx, sy) <= RADAR.range)
      drawEvent(ctx, c + sx * k, c + sy * k, RADAR.eventSize, ob.kind, pulse);
    else {
      const ang = Math.atan2(sy, sx);
      ctx.fillStyle = eventColor(ob.kind);
      drawArrow(ctx, c + Math.cos(ang) * (R - 12), c + Math.sin(ang) * (R - 12), ang, 1.5);
    }
  }

  // El jugador, en el centro, apuntando hacia donde se mueve (al pararse, hacia donde se movió por última vez).
  const face = Math.atan2(isoY(p.facingX, p.facingY), isoX(p.facingX, p.facingY));
  ctx.save();
  ctx.translate(c, c);
  ctx.rotate(face + Math.PI / 2);
  ctx.fillStyle = RADAR.phosphor;
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(5, 5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
