// Expedición, pestaña Expedición: elegir con quién, a pantalla completa con los retratos del plantel (la otra pestaña es
// la colección de supervivientes).
// El último usado sale marcado.
import { useTranslation } from 'react-i18next';
import { ROSTER, type StatSurvivorId } from '../../../config/survivors';
import { DAILY } from '../../../config/modes';
import { dailyChallenge } from '../../../meta/daily';
import { useSaveData } from '../../../store/save';
import { PortraitCard } from './Portraits';

interface Props {
  onStart: (id: StatSurvivorId) => void;
  onDaily: () => void;
  onBack: () => void;
  /** Pestañas Expedición / Supervivientes. */
  nav?: React.ReactNode;
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

export function Expedition({ onStart, onDaily, onBack, nav }: Props) {
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
      {nav}
      <DailyCard onPlay={onDaily} />
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
