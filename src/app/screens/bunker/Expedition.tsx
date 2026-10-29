// Antes de salir de expedición: elegir con quién, a pantalla completa con los retratos del plantel.
// El último usado sale marcado.
import { useTranslation } from 'react-i18next';
import { ROSTER, type StatSurvivorId } from '../../../config/survivors';
import { useSaveData } from '../../../store/save';
import { PortraitCard } from './Portraits';

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
              <PortraitCard
                id={id}
                level={o?.level ?? 1}
                weapon={o?.starter ?? undefined}
                active={active === id}
                autoFocus={active ? active === id : i === 0}
                onClick={() => onStart(id)}
              />
            </li>
          );
        })}
      </ul>
    </main>
  );
}
