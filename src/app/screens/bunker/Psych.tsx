// Perfil psicológico (02_GAMEPLAY.md §9): examen de aptitud del Ministerio en la primera partida.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PSYCH, STARTERS, type StarterId } from '../../../config/meta';
import { SURVIVORS } from '../../../config/survivors';
import { chooseStarter, psychResult } from '../../../meta/actions';
import { useSave } from '../../../store/save';
import { SurvivorCard } from './common';
import { newSurvivor } from '../../../meta/save';

export function Psych() {
  const { t } = useTranslation();
  const act = useSave((s) => s.act);
  const [answers, setAnswers] = useState<number[]>([]);
  const [other, setOther] = useState(false);
  const done = answers.length >= PSYCH.questions;
  const q = answers.length;
  const pick = (id: StarterId): void => act((d) => chooseStarter(d, id));

  if (!done) {
    // Las respuestas se rotan por pregunta para que la primera opción no sea siempre la misma.
    const order = STARTERS.map((_, i) => (i + q) % STARTERS.length);
    return (
      <main className="terminal psych">
        <header className="terminal__head">
          <h1>{t('psych.title')}</h1>
          <p>{t('psych.form', { n: q + 1, total: PSYCH.questions })}</p>
        </header>
        <h2>{t(`psych.q${q + 1}.q`)}</h2>
        <ul className="psych__answers">
          {order.map((a, i) => (
            <li key={a}>
              <button
                className="psych__answer"
                autoFocus={i === 0}
                onClick={() => setAnswers([...answers, a])}
              >
                <span className="psych__box" aria-hidden="true">
                  ☐
                </span>{' '}
                {t(`psych.q${q + 1}.a${a}`)}
              </button>
            </li>
          ))}
        </ul>
        <p className="psych__fine">{t('psych.fine')}</p>
      </main>
    );
  }

  const res = psychResult(answers);
  return (
    <main className="terminal psych">
      <header className="terminal__head">
        <h1>{t('psych.title')}</h1>
      </header>
      <h2>{t('psych.verdict')}</h2>
      {!other ? (
        <>
          <ul className="cards">
            <li>
              <SurvivorCard id={res} owned={newSurvivor()}>
                <small>{t(`passives.${res}`)}</small>
                <small>{t('psych.why', { weapon: t(`weapons.${SURVIVORS[res].weapon}.name`) })}</small>
              </SurvivorCard>
            </li>
          </ul>
          <div className="row">
            <button className="btn btn--primary" autoFocus onClick={() => pick(res)}>
              {t('psych.accept')}
            </button>
            <button className="btn" onClick={() => setOther(true)}>
              {t('psych.other')}
            </button>
          </div>
        </>
      ) : (
        <ul className="cards">
          {STARTERS.map((id) => (
            <li key={id}>
              <SurvivorCard id={id} owned={newSurvivor()} onClick={() => pick(id)}>
                <small>{t(`passives.${id}`)}</small>
              </SurvivorCard>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
