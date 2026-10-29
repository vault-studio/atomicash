// Perfil psicológico (02_GAMEPLAY.md §9): examen de aptitud del Ministerio en la primera partida.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PSYCH, STARTERS, type StarterId } from '../../../config/meta';
import { chooseStarter, psychResult } from '../../../meta/actions';
import { useSave } from '../../../store/save';
import { PortraitCard } from './Portraits';

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
  // Veredicto a pantalla completa con el retrato grande, como al salir de expedición.
  if (!other)
    return (
      <main className="pick psych-verdict">
        <header className="pick__head">
          <h1>{t('psych.verdict')}</h1>
        </header>
        <div className="psych-verdict__body">
          <PortraitCard id={res} level={1} active />
          <div className="psych-verdict__text">
            <p>{t('psych.title')}</p>
            <p className="psych-verdict__name">{t(`entities.${res}`)}</p>
            <div className="row">
              <button className="btn btn--primary" autoFocus onClick={() => pick(res)}>
                {t('psych.accept')}
              </button>
              <button className="btn" onClick={() => setOther(true)}>
                {t('psych.other')}
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  return (
    <main className="pick">
      <header className="pick__head">
        <button className="term-btn" onClick={() => setOther(false)}>
          {t('psych.back')}
        </button>
        <h1>{t('psych.other')}</h1>
      </header>
      <ul className="pick__list">
        {STARTERS.map((id, i) => (
          <li key={id}>
            <PortraitCard id={id} level={1} autoFocus={i === 0} onClick={() => pick(id)} />
          </li>
        ))}
      </ul>
    </main>
  );
}
