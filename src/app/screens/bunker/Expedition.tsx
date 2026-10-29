// Antes de salir de expedición: elegir con quién, entre los del plantel. El último usado sale marcado.
import { useTranslation } from 'react-i18next';
import { ROSTER, SURVIVORS, type StatSurvivorId } from '../../../config/survivors';
import { useSaveData } from '../../../store/save';
import { Screen, SurvivorCard } from './common';

interface Props {
  onStart: (id: StatSurvivorId) => void;
  onBack: () => void;
}

export function Expedition({ onStart, onBack }: Props) {
  const { t } = useTranslation();
  const survivors = useSaveData((d) => d.survivors);
  const active = useSaveData((d) => d.profile.active);

  return (
    <Screen title={t('bunker.expedition.cmd')} onBack={onBack}>
      <p>{t('expedition.pick')}</p>
      <ul className="cards cards--wide">
        {ROSTER.map((id) => {
          const o = survivors[id];
          return (
            <li key={id}>
              <SurvivorCard id={id} owned={o} active={active === id} onClick={() => onStart(id)}>
                <small>{t(`passives.${id}`)}</small>
                <small>
                  {t('collection.starter')}: {t(`weapons.${o?.starter ?? SURVIVORS[id].weapon}.name`)}
                </small>
                <span className="expedition__go">{t('expedition.go')}</span>
              </SurvivorCard>
            </li>
          );
        })}
      </ul>
    </Screen>
  );
}
