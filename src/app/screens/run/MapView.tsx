// Mapa de la pausa: lo que hay alrededor del jugador a pantalla completa, con el nombre de cada sitio. La partida está
// parada, así que se pinta una vez (y al cambiar de tamaño) sobre lo que devuelve `scanArea`.
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MAP } from '../../../config/render';
import { scanArea } from '../../../engine/obstacles';
import type { World } from '../../../engine/types';
import { chestArtReady } from './mapArt';
import { MapKey } from './MapKey';
import { useTapGuard } from './tapGuard';
import { paintMap } from './mapPaint';

export type Label = (key: string) => string;

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
