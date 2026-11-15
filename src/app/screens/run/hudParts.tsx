// Piezas del HUD: aviso de horda, flechas de borde y textos de los avisos.
import { useTranslation } from 'react-i18next';
import type { Banner } from '../../../engine/types';
import type { HudSnapshot } from '../../runSession';

/**
 * Aviso de horda en el borde de la pantalla por donde llegará (el anillo, en todos los bordes). La flecha se pega al
 * rectángulo de la pantalla siguiendo la dirección.
 */
export function HordeWarning({ horde }: { horde: NonNullable<HudSnapshot['horde']> }) {
  if (horde.kind === 'ring') return <div className="hud__edge-ring" />;
  return <EdgeArrow sx={horde.sx} sy={horde.sy} kind="horde" />;
}

/** Flecha pegada al borde de la pantalla en la dirección (sx, sy): roja para hordas, amarilla para objetivos. */
export function EdgeArrow({ sx, sy, kind }: { sx: number; sy: number; kind: 'horde' | 'objective' }) {
  const k = 1 / Math.max(Math.abs(sx), Math.abs(sy));
  const left = 50 + sx * k * 44;
  const top = 50 + sy * k * 40;
  const deg = (Math.atan2(sy, sx) * 180) / Math.PI;
  return (
    <div className={`hud__edge is-${kind}`} style={{ left: `${left}%`, top: `${top}%` }}>
      <span className="hud__edge-arrow" style={{ transform: `rotate(${deg}deg)` }}>
        ➤
      </span>
      <span className="hud__edge-sign">{kind === 'horde' ? '!' : '◎'}</span>
    </div>
  );
}

export function useBannerText(): (b: Banner) => string {
  const { t } = useTranslation();
  return (b) => {
    const params: Record<string, string> = { ...b.params };
    if (b.params.boss) params.name = t(`entities.${b.params.boss}`).toUpperCase();
    if (b.params.weapon) params.name = t(`weapons.${b.params.weapon}.name`);
    if (b.params.elite) params.prefix = t(`elites.${b.params.elite}`);
    if (b.params.enemy) params.name = t(`entities.${b.params.enemy}`);
    return t(b.key, params);
  };
}
