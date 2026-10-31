// Cuenta y nube (Ajustes) y ranking (Tablón). Sin configuración de Supabase solo explican el modo local.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ONLINE_ENABLED,
  fetchBoard,
  linkGoogle,
  reportRun,
  setNickname,
  signOut,
  type BoardKind,
  type BoardPeriod,
  type BoardRow,
  type ReportReason,
} from '../../../online/online';
import { connect, pullSave, pushSave } from '../../../online/session';
import { useOnline } from '../../../store/online';
import { fmtTime } from '../run/Hud';

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
          <small>{t('online.privacy')}</small>
        </p>
        <button className="btn" disabled={on.status === 'busy'} onClick={() => void connect()}>
          {t(on.status === 'busy' ? 'online.connecting' : 'online.connect')}
        </button>
        {on.status === 'error' && <p role="status">{t('online.error')}</p>}
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
            void signOut().then(() => on.set({ account: null, connected: false, lastSyncAt: null }))
          }
        >
          {t('online.signOut')}
        </button>
      </div>
      {msg && <p role="status">{msg}</p>}
    </>
  );
}

const REASONS: readonly ReportReason[] = ['nickname', 'cheat', 'other'];

export function Leaderboard() {
  const { t } = useTranslation();
  const [kind, setKind] = useState<BoardKind>('dmg');
  const [period, setPeriod] = useState<BoardPeriod>('day');
  const [rows, setRows] = useState<BoardRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [reporting, setReporting] = useState<number | null>(null);
  const [reported, setReported] = useState<number[]>([]);

  useEffect(() => {
    if (!ONLINE_ENABLED) return;
    let alive = true;
    fetchBoard(kind, period)
      .then((r) => {
        if (alive) {
          setRows(r);
          setFailed(false);
        }
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [kind, period]);

  if (!ONLINE_ENABLED) return <p>{t('online.disabled')}</p>;

  const pick = (k: BoardKind, p: BoardPeriod): void => {
    if (k === kind && p === period) return;
    setRows(null);
    setKind(k);
    setPeriod(p);
  };

  const report = (id: number, reason: ReportReason): void => {
    setReporting(null);
    void reportRun(id, reason).then((ok) => {
      if (ok) setReported((r) => [...r, id]);
    });
  };

  return (
    <>
      <div className="chips" role="tablist">
        {(['dmg', 'finish', 'daily'] as const).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={k === kind}
            className="chip"
            onClick={() => pick(k, period)}
          >
            {t(`online.board.${k}`)}
          </button>
        ))}
      </div>
      <div className="chips" role="tablist" hidden={kind === 'daily'}>
        {(['day', 'week', 'all'] as const).map((p) => (
          <button
            key={p}
            role="tab"
            aria-selected={p === period}
            className="chip"
            onClick={() => pick(kind, p)}
          >
            {t(`online.period.${p}`)}
          </button>
        ))}
      </div>
      {failed && <p>{t('online.error')}</p>}
      {!rows && !failed && <p>{t('app.loading')}</p>}
      {rows && rows.length === 0 && <p>{t('online.empty')}</p>}
      {rows && rows.length > 0 && (
        <ol className="shop board">
          {rows.map((r, i) => (
            <li key={r.id} className="shop__row">
              <span>
                <strong>
                  {i + 1}. {r.nickname}
                </strong>{' '}
                <small>{t(`entities.${r.charId}`, { defaultValue: r.charId })}</small>
              </span>
              <span>
                {kind === 'finish'
                  ? `${fmtTime(r.timeSec)} · ${t('online.kills', { n: r.kills })}`
                  : `${t('online.dmg', { n: r.dmgTotal })} · ${fmtTime(r.timeSec)}${r.won ? ' ★' : ''}`}
              </span>
              {reporting === r.id ? (
                <span className="row">
                  {REASONS.map((why) => (
                    <button key={why} className="chip" onClick={() => report(r.id, why)}>
                      {t(`online.reason.${why}`)}
                    </button>
                  ))}
                </span>
              ) : (
                <span className="row">
                  <button
                    className="chip"
                    disabled={reported.includes(r.id)}
                    onClick={() => setReporting(r.id)}
                  >
                    {t(reported.includes(r.id) ? 'online.reported' : 'online.report')}
                  </button>
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
