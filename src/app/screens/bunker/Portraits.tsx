// Retratos del plantel: de cuerpo entero (selección de expedición y ficha) y de busto (pausa, taller).
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import benny from '../../../../assets/portraits/benny.webp';
import dot from '../../../../assets/portraits/dot.webp';
import gus from '../../../../assets/portraits/gus.webp';
import bennyHead from '../../../../assets/portraits/heads/benny.webp';
import dotHead from '../../../../assets/portraits/heads/dot.webp';
import gusHead from '../../../../assets/portraits/heads/gus.webp';
import { SURVIVORS, type StatSurvivorId } from '../../../config/survivors';
import { useSaveData } from '../../../store/save';
import { weaponIcon } from '../../icons';
import { RARITY_COLOR, Stars } from './common';

const PORTRAITS: Readonly<Partial<Record<StatSurvivorId, string>>> = { dot, gus, benny };
const HEADS: Readonly<Partial<Record<StatSurvivorId, string>>> = {
  dot: dotHead,
  gus: gusHead,
  benny: bennyHead,
};

/** Retrato de cuerpo entero; undefined si el personaje aún no tiene. */
export const portraitOf = (id: StatSurvivorId): string | undefined => PORTRAITS[id];

/** Busto con fondo transparente; undefined si el personaje aún no tiene. */
export const headOf = (id: StatSurvivorId): string | undefined => HEADS[id];

/**
 * Retrato de cuerpo entero con su placa: rareza, nombre, estrellas y nivel (selección y ficha del personaje). Con
 * `details`, también su pasiva y su arma principal (la inicial elegida).
 */
export function HeroPortrait({ id, details }: { id: StatSurvivorId; details?: boolean }) {
  const { t } = useTranslation();
  const o = useSaveData((d) => d.survivors[id]);
  const rarity = SURVIVORS[id].rarity;
  return (
    <div
      className={o?.irradiated ? 'hero is-irradiated' : 'hero'}
      style={{ '--rarity': RARITY_COLOR[rarity] } as CSSProperties}
    >
      <img className="hero__img" src={PORTRAITS[id]} alt="" />
      <span className="hero__rarity">{t(`rarity.${rarity}`)}</span>
      {o?.irradiated && <span className="hero__irr">☢ {t('collection.irradiated')}</span>}
      <div className="hero__plate">
        <strong className="hero__name">{t(`entities.${id}`)}</strong>
        <span className="hero__meta">
          <Stars n={o?.stars ?? 1} />
          <span className="hero__level">{t('collection.level', { n: o?.level ?? 1 })}</span>
        </span>
        {details && (
          <dl className="hero__details">
            <div>
              <dt>{t('sheet.passive')}</dt>
              <dd>{t(`passives.${id}`)}</dd>
            </div>
            <div>
              <dt>{t('sheet.weapon')}</dt>
              <dd className="hero__weapon">
                <img src={weaponIcon(o?.starter ?? SURVIVORS[id].weapon)} alt="" />
                {t(`weapons.${o?.starter ?? SURVIVORS[id].weapon}.name`)}
              </dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  );
}
