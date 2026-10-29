// Radar del HUD: lee el mundo cada frame (sin tocarlo) y pinta en un canvas propio los edificios, los recogibles de
// campo y las cajas de alrededor del jugador, cada tipo con su color. Lo que queda fuera del alcance sale como flecha en el
// borde, apuntando hacia donde está. Estética de pantalla de fósforo: anillos, cruz y barrido.
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { RADAR } from '../../../config/render';
import type { PickupKind, World } from '../../../engine/types';
import { isoX, isoY } from '../../../engine/view';

type RadarKind = keyof typeof RADAR.kinds;
const KINDS = Object.keys(RADAR.kinds) as RadarKind[];
const isRadarKind = (k: PickupKind): k is RadarKind => k in RADAR.kinds;

interface Props {
  world: World;
}

export function Minimap({ world }: Props) {
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
      <canvas ref={ref} className="radar__screen" aria-label={t('run.radar')} />
      <ul className="radar__legend">
        {KINDS.map((k) => (
          <li key={k}>
            <i style={{ background: RADAR.kinds[k] }} />
            {t(`pickups.${k}`)}
          </li>
        ))}
      </ul>
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

  // Edificios: dentro, un rombo; fuera, una flecha en el borde.
  const S = RADAR.buildingSize;
  for (const b of w.buildings) {
    const dx = b.x - p.x;
    const dy = b.y - p.y;
    const sx = isoX(dx, dy);
    const sy = isoY(dx, dy);
    const color = RADAR.buildings[b.kind];
    ctx.fillStyle = color;
    ctx.strokeStyle = RADAR.bg;
    ctx.lineWidth = 1.5;
    if (Math.hypot(sx, sy) <= RADAR.range) {
      const x = c + sx * k;
      const y = c + sy * k;
      ctx.beginPath();
      ctx.moveTo(x, y - S / 2);
      ctx.lineTo(x + S, y);
      ctx.lineTo(x, y + S / 2);
      ctx.lineTo(x - S, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      const ang = Math.atan2(sy, sx);
      ctx.globalAlpha = 0.6;
      arrow(ctx, c + Math.cos(ang) * (R - 9), c + Math.sin(ang) * (R - 9), ang);
      ctx.globalAlpha = 1;
    }
  }

  // Recogibles y cajas: dentro, un punto; fuera, una flecha en el borde.
  for (let i = 0; i < w.pickups.count; i++) {
    const it = w.pickups.items[i]!;
    if (!isRadarKind(it.kind)) continue;
    const dx = it.x - p.x;
    const dy = it.y - p.y;
    const sx = isoX(dx, dy);
    const sy = isoY(dx, dy);
    const d = Math.hypot(sx, sy);
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
      arrow(ctx, c + Math.cos(ang) * (R - 9), c + Math.sin(ang) * (R - 9), ang);
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

  // Objetivo: anillo amarillo que late; fuera, flecha en el borde.
  const ob = w.objective;
  if (ob) {
    const sx = isoX(ob.x - p.x, ob.y - p.y);
    const sy = isoY(ob.x - p.x, ob.y - p.y);
    ctx.strokeStyle = ctx.fillStyle = RADAR.objective;
    ctx.lineWidth = 2;
    if (Math.hypot(sx, sy) <= RADAR.range) {
      ctx.beginPath();
      ctx.arc(c + sx * k, c + sy * k, 5 + 3 * pulse, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const ang = Math.atan2(sy, sx);
      arrow(ctx, c + Math.cos(ang) * (R - 9), c + Math.sin(ang) * (R - 9), ang);
    }
  }

  // El jugador, en el centro.
  ctx.fillStyle = RADAR.phosphor;
  ctx.beginPath();
  ctx.moveTo(c, c - 6);
  ctx.lineTo(c + 5, c + 5);
  ctx.lineTo(c - 5, c + 5);
  ctx.closePath();
  ctx.fill();
}

/** Flecha que apunta en `ang` con la punta en (x, y) + 6 px. */
function arrow(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -6);
  ctx.lineTo(-2, 0);
  ctx.lineTo(-5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
