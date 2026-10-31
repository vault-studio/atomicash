// Ajustes (05_TECH.md §4): sonido, gráficos, accesibilidad, idioma y copia de la partida.
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '../../../i18n';
import { exportSave, importSave, type Settings as S } from '../../../meta/save';
import { useSave } from '../../../store/save';
import { Screen } from './common';
import { OnlinePanel } from './Online';

export function Settings({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const data = useSave((s) => s.data);
  const act = useSave((s) => s.act);
  const replace = useSave((s) => s.replace);
  const reset = useSave((s) => s.reset);
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const st = data.settings;
  const set = <K extends keyof S>(k: K, v: S[K]): void =>
    act((d) => {
      d.settings[k] = v;
    });

  const doExport = (): void => {
    const blob = new Blob([exportSave(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `atomicash-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg(t('settings.exported'));
  };

  const doImport = async (f: File): Promise<void> => {
    const s = importSave(await f.text());
    if (!s) setMsg(t('settings.importBad'));
    else if (window.confirm(t('settings.importConfirm'))) {
      replace(s);
      setMsg(t('settings.imported'));
    }
  };

  const toggle = (k: 'crtFilter' | 'damageNumbers' | 'reduceMotion'): React.ReactNode => (
    <label className="field field--check">
      <input type="checkbox" checked={st[k]} onChange={(e) => set(k, e.target.checked)} />
      <span>{t(`settings.${k}`)}</span>
    </label>
  );
  const slider = (k: 'musicVol' | 'sfxVol'): React.ReactNode => (
    <label className="field">
      <span>
        {t(`settings.${k}`)} · {Math.round(st[k] * 100)} %
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={st[k]}
        onChange={(e) => set(k, Number(e.target.value))}
      />
    </label>
  );

  return (
    <Screen title={t('bunker.settings.cmd')} onBack={onBack}>
      <h2>{t('settings.sound')}</h2>
      {slider('musicVol')}
      {slider('sfxVol')}
      <p>
        <small>{t('settings.audioCredits')}</small>
      </p>
      <h2>{t('settings.graphics')}</h2>
      {toggle('crtFilter')}
      {toggle('damageNumbers')}
      <h2>{t('settings.access')}</h2>
      {toggle('reduceMotion')}
      <label className="field">
        <span>{t('app.language')}</span>
        <select value={st.language} onChange={(e) => set('language', e.target.value as S['language'])}>
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {t(`settings.lang.${l}`)}
            </option>
          ))}
        </select>
      </label>
      <h2>{t('online.title')}</h2>
      <OnlinePanel />
      <h2>{t('settings.save')}</h2>
      <p>
        <small>{t('settings.saveHint')}</small>
      </p>
      <div className="row">
        <button className="btn" onClick={doExport}>
          {t('settings.export')}
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          {t('settings.import')}
        </button>
        <button
          className="btn btn--danger"
          onClick={() => {
            if (window.confirm(t('settings.resetConfirm'))) reset();
          }}
        >
          {t('settings.reset')}
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void doImport(f);
          e.target.value = '';
        }}
      />
      {msg && <p role="status">{msg}</p>}
    </Screen>
  );
}
