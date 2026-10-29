import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { audio } from '../audio/audio';
import { applyRun, refreshDaily, runOptionsFor, setActive } from '../meta/actions';
import { useSave } from '../store/save';
import { useOnline } from '../store/online';
import { connect, afterRun } from '../online/session';
import type { RunResults } from '../engine/world';
import type { StatSurvivorId } from '../config/survivors';
import { RunScreen } from './screens/RunScreen';
import { Backpack } from './screens/bunker/Backpack';
import { Board } from './screens/bunker/Board';
import { Bunker, type BunkerView } from './screens/bunker/Bunker';
import { Expedition } from './screens/bunker/Expedition';
import { Merchant } from './screens/bunker/Merchant';
import { Psych } from './screens/bunker/Psych';
import { Settings } from './screens/bunker/Settings';
import { Supplies } from './screens/bunker/Supplies';
import { Tree } from './screens/bunker/Tree';
import { Survivors } from './screens/bunker/Survivors';
import { Workshop } from './screens/bunker/Workshop';
import { RunReward } from './screens/run/RunReward';

type View = BunkerView | 'bunker';

export function App() {
  const { t, i18n } = useTranslation();
  const data = useSave((s) => s.data);
  const act = useSave((s) => s.act);
  const [view, setView] = useState<View>('bunker');
  /** Superviviente elegido al salir de expedición; null mientras se elige. */
  const [runChar, setRunChar] = useState<StatSurvivorId | null>(null);
  const st = data.settings;
  const active = data.profile.active;

  // Ajustes que viven fuera de React: idioma, volúmenes, filtro CRT y movimiento reducido.
  useEffect(() => {
    if (i18n.resolvedLanguage !== st.language) void i18n.changeLanguage(st.language);
    document.documentElement.lang = st.language;
  }, [i18n, st.language]);
  useEffect(() => audio.setVolumes(st.musicVol, st.sfxVol), [st.musicVol, st.sfxVol]);
  useEffect(() => {
    const el = document.documentElement.classList;
    el.toggle('crt', st.crtFilter);
    el.toggle('reduce-motion', st.reduceMotion);
  }, [st.crtFilter, st.reduceMotion]);

  // Si el jugador ya aceptó conectarse, se reconecta solo (también al volver del login de Google).
  useEffect(() => {
    if (useOnline.getState().connected) void connect();
  }, []);

  // Misiones del día al abrir y al volver al Búnker (cambian a medianoche local).
  useEffect(() => {
    if (view === 'bunker' || view === 'board') act((d) => refreshDaily(d, new Date()));
  }, [act, view]);

  const runSettings = useMemo(
    () => ({ showDamage: st.damageNumbers, reduceMotion: st.reduceMotion }),
    [st.damageNumbers, st.reduceMotion],
  );
  const worldOptions = useMemo(() => (active ? runOptionsFor(data, active) : undefined), [data, active]);
  const back = useCallback(() => {
    setRunChar(null);
    setView('bunker');
  }, []);
  const start = useCallback(
    (id: StatSurvivorId) => {
      act((d) => setActive(d, id));
      setRunChar(id);
    },
    [act],
  );
  const finish = useCallback(
    (r: RunResults) => {
      const reward = act((d) => applyRun(d, r, new Date()));
      afterRun(r);
      return <RunReward reward={reward} />;
    },
    [act],
  );

  let screen: React.ReactNode;
  if (!data.profile.starterChosen) screen = <Psych />;
  else if (view === 'expedition' && !runChar) screen = <Expedition onStart={start} onBack={back} />;
  else if (view === 'expedition' && runChar)
    screen = (
      <RunScreen
        charId={runChar}
        settings={runSettings}
        worldOptions={worldOptions}
        onExit={back}
        onFinish={finish}
      />
    );
  else if (view === 'survivors') screen = <Survivors onBack={back} />;
  else if (view === 'workshop') screen = <Workshop onBack={back} />;
  else if (view === 'tree') screen = <Tree onBack={back} />;
  else if (view === 'merchant') screen = <Merchant onBack={back} />;
  else if (view === 'backpack') screen = <Backpack onBack={back} />;
  else if (view === 'supplies') screen = <Supplies onBack={back} />;
  else if (view === 'board') screen = <Board onBack={back} />;
  else if (view === 'settings') screen = <Settings onBack={back} />;
  else screen = <Bunker onGo={setView} />;

  return (
    <>
      {screen}
      <div className="rotate">{t('app.rotate')}</div>
    </>
  );
}
