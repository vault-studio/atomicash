// Cuenta y nube (Ajustes) y ranking (Tablón). Sin configuración de Supabase solo explican el modo local.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ONLINE_ENABLED, linkGoogle, setNickname, signOut } from '../../../online/online';
import { connect, loginGoogle, pullSave, pushSave } from '../../../online/session';
import { useOnline } from '../../../store/online';

export function OnlinePanel() {
  const { t } = useTranslation();
  const on = useOnline();
  const acc = on.account;
  const [nick, setNick] = useState(acc?.nickname ?? '');
  const [msg, setMsg] = useState<string | null>(null);

  if (!ONLINE_ENABLED) return <p>{t('online.disabled')}</p>;

  if (!acc)
    return (
      <>
        <p>
          <small>
            {t('online.privacy')}{' '}
            <a href="/privacidad" target="_blank" rel="noreferrer">
              {t('online.privacyLink')}
            </a>
          </small>
        </p>
        <div className="row">
          <button className="btn" disabled={on.status === 'busy'} onClick={() => void connect()}>
            {t(on.status === 'busy' ? 'online.connecting' : 'online.connect')}
          </button>
          <button
            className="btn btn--primary"
            disabled={on.status === 'busy'}
            onClick={() => void loginGoogle().catch(() => on.set({ status: 'error' }))}
          >
            {t('online.signInGoogle')}
          </button>
        </div>
        {(on.status === 'error' || on.authReturn === 'error') && <p role="status">{t('online.error')}</p>}
      </>
    );

  const saveNick = async (): Promise<void> => {
    const err = await setNickname(acc.userId, nick);
    if (err) setMsg(t(`online.nickErr.${err}`));
    else {
      on.set({ account: { ...acc, nickname: nick.trim() } });
      setMsg(t('online.nickOk'));
    }
  };

  return (
    <>
      <p>
        {acc.guest ? t('online.guest') : t('online.linked', { email: acc.email ?? '' })}
        {on.lastSyncAt && <> · {t('online.synced', { when: new Date(on.lastSyncAt).toLocaleString() })}</>}
      </p>
      <label className="field">
        <span>{t('online.nickname')}</span>
        <input value={nick} maxLength={16} onChange={(e) => setNick(e.target.value)} />
      </label>
      <div className="row">
        <button className="btn" onClick={() => void saveNick()}>
          {t('online.saveNick')}
        </button>
        {acc.guest && (
          <button
            className="btn btn--primary"
            onClick={() => void linkGoogle().catch(() => setMsg(t('online.error')))}
          >
            {t('online.linkGoogle')}
          </button>
        )}
      </div>
      {on.authReturn === 'identity-taken' && acc.guest && (
        <div className="online-taken" role="status">
          <p>{t('online.identityTaken')}</p>
          <button
            className="btn btn--primary"
            onClick={() => void loginGoogle().catch(() => setMsg(t('online.error')))}
          >
            {t('online.signInGoogle')}
          </button>
        </div>
      )}
      {on.authReturn === 'error' && <p role="status">{t('online.error')}</p>}
      <label className="field field--check">
        <input
          type="checkbox"
          checked={on.autoSubmit}
          onChange={(e) => on.set({ autoSubmit: e.target.checked })}
        />
        <span>{t('online.autoSubmit')}</span>
      </label>
      <div className="row">
        <button
          className="btn"
          onClick={() => void pushSave().then((ok) => setMsg(t(ok ? 'online.pushed' : 'online.error')))}
        >
          {t('online.push')}
        </button>
        <button
          className="btn"
          onClick={() => {
            if (window.confirm(t('online.pullConfirm')))
              void pullSave().then((ok) => setMsg(t(ok ? 'online.pulled' : 'online.noCloud')));
          }}
        >
          {t('online.pull')}
        </button>
        <button
          className="btn btn--danger"
          onClick={() =>
            void signOut().then(() =>
              on.set({ account: null, connected: false, lastSyncAt: null, conflict: null, authReturn: null }),
            )
          }
        >
          {t('online.signOut')}
        </button>
      </div>
      {msg && <p role="status">{msg}</p>}
    </>
  );
}
