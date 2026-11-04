// Leyenda del radar y del mapa: el marcador de cada tipo de sitio con su nombre.
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MAP, RADAR } from '../../../config/render';
import { chestArtReady, drawChest, drawEvent, drawZone } from './mapArt';

type KeyId = 'zone' | 'supply' | 'chest' | 'event' | 'done' | 'lake' | 'enemy';

const BASIC: readonly KeyId[] = ['zone', 'supply', 'chest', 'event'];
const FULL: readonly KeyId[] = [...BASIC, 'done', 'lake', 'enemy'];
const SIZE = 26;

function paintKey(ctx: CanvasRenderingContext2D, id: KeyId): void {
  const c = SIZE / 2;
  ctx.clearRect(0, 0, SIZE, SIZE);
  if (id === 'zone') drawZone(ctx, c, c, 10, 'necro', 'new', 0);
  else if (id === 'supply') drawZone(ctx, c, c, 10, 'supply', 'new', 0);
  else if (id === 'done') drawZone(ctx, c, c, 10, 'raiders', 'done', 0);
  else if (id === 'chest') drawChest(ctx, c, c, 21, 'chest');
  else if (id === 'event') drawEvent(ctx, c, c, 9, 'hold', 0.5);
  else if (id === 'enemy') {
    ctx.fillStyle = MAP.enemy;
    ctx.beginPath();
    ctx.arc(c, c, 4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = RADAR.lake;
    ctx.beginPath();
    ctx.ellipse(c, c, 11, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function KeyIcon({ id }: { id: KeyId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = canvas.height = SIZE * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let live = true;
    paintKey(ctx, id);
    void chestArtReady().then(() => {
      if (live) paintKey(ctx, id);
    });
    return () => {
      live = false;
    };
  }, [id]);
  return <canvas ref={ref} className="mapkey__icon" aria-hidden="true" />;
}

export function MapKey({ full = false, className }: { full?: boolean; className?: string }) {
  const { t } = useTranslation();
  return (
    <ul className={className ? `mapkey ${className}` : 'mapkey'}>
      {(full ? FULL : BASIC).map((id) => (
        <li key={id}>
          <KeyIcon id={id} />
          {t(`map.key.${id}`)}
        </li>
      ))}
    </ul>
  );
}
