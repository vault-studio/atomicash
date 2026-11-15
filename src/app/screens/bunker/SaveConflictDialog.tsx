// Conflicto de partidas al entrar con Google: elegir la local o la de la nube.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { pullSave, pushSave } from '../../../online/session';
import { useOnline } from '../../../store/online';

/** Al entrar con una cuenta que ya tiene otra partida en la nube: el jugador elige cuál conservar. */
export function SaveConflictDialog() {
  const { t } = useTranslation();
  const conflict = useOnline((s) => s.conflict);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!conflict) return null;
  const pick = (keep: () => Promise<boolean>): void => {
    setBusy(true);
    void keep().then((ok) => {
      setBusy(false);
      setFailed(!ok);
    });
  };
  return (
    <div className="overlay save-conflict" role="dialog" aria-modal="true">
      <h2 className="overlay__title">{t('online.conflict.title')}</h2>
      <p className="endless__text">{t('online.conflict.text')}</p>
      <div className="overlay__actions">
        <button className="btn btn--primary" autoFocus disabled={busy} onClick={() => pick(pullSave)}>
          {t('online.conflict.cloud', {
            n: conflict.cloudRuns,
            when: new Date(conflict.cloudAt).toLocaleString(),
          })}
        </button>
        <button className="btn" disabled={busy} onClick={() => pick(pushSave)}>
          {t('online.conflict.local', { n: conflict.localRuns })}
        </button>
      </div>
      {failed && <p role="status">{t('online.error')}</p>}
    </div>
  );
}
