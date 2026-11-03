// Expedición: elegir con quién salir. A la izquierda el retrato grande del personaje marcado; a la derecha, la
// cuadrícula de retratos (3 ahora, hecha para 9) y el botón «Seleccionar», que lo deja como activo y abre su ficha.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ROSTER, type RosterId, type StatSurvivorId } from '../../../config/survivors';
import { DAILY } from '../../../config/modes';
import { setActive } from '../../../meta/actions';
import { dailyChallenge } from '../../../meta/daily';
import { useSave, useSaveData } from '../../../store/save';
import { CharacterSheet } from './CharacterSheet';
import { HeroPortrait, portraitOf } from './Portraits';

interface Props {
  onStart: (id: StatSurvivorId) => void;
  onDaily: () => void;
  onBack: () => void;
}

/** Reto del día: superviviente, modificador, tu mejor marca de hoy y el premio del primer intento. */
function DailyCard({ onPlay }: { onPlay: () => void }) {
  const { t } = useTranslation();
  const saved = useSaveData((d) => d.daily);
  const c = dailyChallenge(new Date());
  const today = saved.day === c.day ? saved : null;
  return (
    <section className="daily">
      <div className="daily__text">
        <strong>{t('daily.title', { day: c.day })}</strong>
        <span>
          {t(`entities.${c.charId}`)} · <b>{t(`daily.mod.${c.mod}.name`)}</b>: {t(`daily.mod.${c.mod}.desc`)}
        </span>
        <small>
          {t('daily.rules')}{' '}
          {today?.best
            ? t('daily.best', { dmg: today.best.dmg.toLocaleString(), kills: today.best.kills })
            : t('daily.reward', { n: DAILY.reward })}
        </small>
      </div>
      <button className="btn btn--primary" onClick={onPlay}>
        {t('daily.play')}
      </button>
    </section>
  );
}

export function Expedition({ onStart, onDaily, onBack }: Props) {
  const { t } = useTranslation();
  const act = useSave((s) => s.act);
  const active = useSaveData((d) => d.profile.active);
  // Al entrar sale marcado el activo.
  const [sel, setSel] = useState<RosterId>(() => ROSTER.find((r) => r === active) ?? ROSTER[0]);
  const [sheet, setSheet] = useState(false);

  if (sheet) return <CharacterSheet id={sel} onBack={() => setSheet(false)} onStart={onStart} />;

  return (
    <main className="pick">
      <header className="pick__head">
        <button className="term-btn" onClick={onBack}>
          {t('bunker.back')}
        </button>
        <h1>{t('expedition.pick')}</h1>
      </header>
      <DailyCard onPlay={onDaily} />
      <div className="pick__body">
        <div className="pick__hero">
          <HeroPortrait id={sel} />
        </div>
        <div className="pick__side">
          <ul className="pick__grid">
            {ROSTER.map((id) => (
              <li key={id}>
                <button
                  className={id === sel ? 'pick__tile is-sel' : 'pick__tile'}
                  aria-pressed={id === sel}
                  aria-label={t(`entities.${id}`)}
                  onClick={() => setSel(id)}
                >
                  <img src={portraitOf(id)} alt="" />
                </button>
              </li>
            ))}
          </ul>
          <button
            className="btn btn--primary pick__go"
            autoFocus
            onClick={() => {
              act((d) => setActive(d, sel));
              setSheet(true);
            }}
          >
            {t('expedition.select')}
          </button>
        </div>
      </div>
    </main>
  );
}
