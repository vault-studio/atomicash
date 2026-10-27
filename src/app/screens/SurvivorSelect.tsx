import { useTranslation } from 'react-i18next';
import { ENTITIES, ENTITY_IDS, type SurvivorId } from '../../config/entities';
import { SURVIVORS, hasStats, type StatSurvivorId } from '../../config/survivors';
import { LANGUAGES } from '../../i18n';

const SURVIVOR_IDS = ENTITY_IDS.filter((id) => ENTITIES[id].category === 'characters') as SurvivorId[];

interface Props {
  onPick: (id: StatSurvivorId) => void;
}

export function SurvivorSelect({ onPick }: Props) {
  const { t, i18n } = useTranslation();

  return (
    <main className="terminal">
      <header className="terminal__head">
        <h1>{t('app.title')}</h1>
        <p>{t('app.subtitle')}</p>
        <label className="lang">
          {t('app.language')}{' '}
          <select value={i18n.resolvedLanguage} onChange={(e) => void i18n.changeLanguage(e.target.value)}>
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
      </header>

      <h2>{t('menu.choose')}</h2>
      <ul className="cards">
        {SURVIVOR_IDS.map((id) => {
          const def = ENTITIES[id];
          const playable = def.status === 'playable' && hasStats(id);
          const stats = hasStats(id) ? SURVIVORS[id] : null;
          return (
            <li key={id}>
              <button
                className="card"
                style={{ borderColor: def.color }}
                disabled={!playable}
                onClick={() => {
                  if (playable) onPick(id);
                }}
              >
                <span className="card__swatch" style={{ background: def.color }} />
                <strong>{t(`entities.${id}`)}</strong>
                {playable && stats ? (
                  <>
                    <small>
                      {t('menu.hp', { value: stats.hp })} · {t('menu.speed', { value: stats.speed })}
                    </small>
                    <small>{t(`passives.${id}`)}</small>
                  </>
                ) : (
                  <small>{t(def.status === 'later' ? 'menu.later' : 'menu.locked')}</small>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
