// Antes de salir de expedición: elegir con quién, a pantalla completa con los retratos del plantel.
// El último usado sale marcado.
import { useTranslation } from 'react-i18next';
import benny from '../../../../assets/portraits/benny.webp';
import dot from '../../../../assets/portraits/dot.webp';
import gus from '../../../../assets/portraits/gus.webp';
import { ROSTER, SURVIVORS, type StatSurvivorId } from '../../../config/survivors';
import { useSaveData } from '../../../store/save';

const PORTRAITS: Readonly<Record<(typeof ROSTER)[number], string>> = { dot, gus, benny };

interface Props {
  onStart: (id: StatSurvivorId) => void;
  onBack: () => void;
}

export function Expedition({ onStart, onBack }: Props) {
  const { t } = useTranslation();
  const survivors = useSaveData((d) => d.survivors);
  const active = useSaveData((d) => d.profile.active);

  return (
    <main className="pick">
      <header className="pick__head">
        <button className="term-btn" onClick={onBack}>
          {t('bunker.back')}
        </button>
        <h1>{t('expedition.pick')}</h1>
      </header>
      <ul className="pick__list">
        {ROSTER.map((id, i) => {
          const o = survivors[id];
          return (
            <li key={id}>
              <button
                className={`pick__card ${active === id ? 'is-active' : ''}`}
                autoFocus={active ? active === id : i === 0}
                onClick={() => onStart(id)}
              >
                <img className="pick__img" src={PORTRAITS[id]} alt="" />
                <span className="pick__info">
                  <strong className="pick__name">{t(`entities.${id}`)}</strong>
                  <span className="pick__level">{t('collection.level', { n: o?.level ?? 1 })}</span>
                  <span className="pick__row">
                    <em>{t('expedition.passive')}</em> {t(`passives.${id}`)}
                  </span>
                  <span className="pick__row">
                    <em>{t('expedition.weapon')}</em> {t(`weapons.${o?.starter ?? SURVIVORS[id].weapon}.name`)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
