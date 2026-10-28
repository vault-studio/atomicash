// Resultados (04_ART_UI.md §2): ticket de caja registradora con tiempo, bajas, créditos y daño por arma.
import { useTranslation } from 'react-i18next';
import type { RunResults } from '../../../engine/world';
import { fmtTime } from './Hud';

interface Props {
  r: RunResults;
  seed: number;
  /** Créditos extra (misiones, logros) sumados al guardar; F3. */
  extra?: React.ReactNode;
  onAgain: () => void;
  onMenu: () => void;
}

export function Results({ r, seed, extra, onAgain, onMenu }: Props) {
  const { t } = useTranslation();
  const sourceName = (src: string): string =>
    src === 'granada' || src === 'hinchado' ? t(`sources.${src}`) : t(`weapons.${src}.name`);
  const top = r.dmgBy.slice(0, 6);
  const max = top[0]?.dmg ?? 1;

  return (
    <div className="overlay overlay--dark" role="dialog" aria-modal="true">
      <div className="ticket">
        <h2 className={r.won ? 'is-won' : ''}>{t(r.won ? 'results.won' : 'results.lost')}</h2>
        <p className="ticket__no">
          {t('results.ticket', { n: String(Math.abs(seed) % 1e6).padStart(6, '0') })}
        </p>
        <dl>
          <dt>{t('results.time')}</dt>
          <dd>{fmtTime(r.time)}</dd>
          <dt>{t('results.kills')}</dt>
          <dd>{r.kills}</dd>
          <dt>{t('results.level')}</dt>
          <dd>{r.level}</dd>
          <dt>{t('results.bosses')}</dt>
          <dd>{r.bosses}</dd>
          <dt>{t('results.dmg')}</dt>
          <dd>{r.dmg.toLocaleString()}</dd>
          <dt>{t('results.rad')}</dt>
          <dd>{r.rad}</dd>
          <dt>{t('results.coupons')}</dt>
          <dd>{r.coupons}</dd>
          <dt className="ticket__total">{t('results.credits')}</dt>
          <dd className="ticket__total">{r.credits}</dd>
        </dl>
        {top.length > 0 && (
          <>
            <h3>{t('results.bySource')}</h3>
            <ul className="ticket__sources">
              {top.map((s) => (
                <li key={s.src}>
                  <span>{sourceName(s.src)}</span>
                  <span className="ticket__bar" style={{ width: `${(s.dmg / max) * 100}%` }} />
                  <span>{s.dmg.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        {extra}
        <p className="ticket__thanks">{t('results.thanks')}</p>
      </div>
      <div className="overlay__actions">
        <button className="btn btn--primary" onClick={onAgain} autoFocus>
          {t('results.again')}
        </button>
        <button className="btn" onClick={onMenu}>
          {t('results.menu')}
        </button>
      </div>
    </div>
  );
}
