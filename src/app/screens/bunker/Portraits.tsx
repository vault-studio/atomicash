// Retratos del plantel: de cuerpo entero (selección de expedición y test inicial) y de busto (pausa).
import { useTranslation } from 'react-i18next';
import benny from '../../../../assets/portraits/benny.webp';
import dot from '../../../../assets/portraits/dot.webp';
import gus from '../../../../assets/portraits/gus.webp';
import bennyHead from '../../../../assets/portraits/heads/benny.webp';
import dotHead from '../../../../assets/portraits/heads/dot.webp';
import gusHead from '../../../../assets/portraits/heads/gus.webp';
import { SURVIVORS, type StatSurvivorId } from '../../../config/survivors';
import type { WeaponId } from '../../../config/weapons';
import { weaponIcon } from '../../icons';

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

interface CardProps {
  id: StatSurvivorId;
  level: number;
  weapon?: WeaponId;
  active?: boolean;
  autoFocus?: boolean;
  onClick?: () => void;
}

/** Retrato de cuerpo entero con placa de datos: nombre, nivel, pasiva y arma inicial. */
export function PortraitCard({ id, level, weapon, active, autoFocus, onClick }: CardProps) {
  const { t } = useTranslation();
  const body = (
    <>
      <img className="pick__img" src={PORTRAITS[id]} alt="" />
      <span className="pick__info">
        <strong className="pick__name">{t(`entities.${id}`)}</strong>
        <span className="pick__level">{t('collection.level', { n: level })}</span>
        <span className="pick__row">
          <em>{t('expedition.passive')}</em> {t(`passives.${id}`)}
        </span>
        <span className="pick__row">
          <em>{t('expedition.weapon')}</em>{' '}
          <img className="wicon" src={weaponIcon(weapon ?? SURVIVORS[id].weapon)} alt="" />
          {t(`weapons.${weapon ?? SURVIVORS[id].weapon}.name`)}
        </span>
      </span>
    </>
  );
  const cls = `pick__card ${active ? 'is-active' : ''}`;
  return onClick ? (
    <button className={cls} autoFocus={autoFocus} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}
