import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { audio } from '../audio/audio';
import { applyRun, chooseStarter, refreshDaily, runOptionsFor, setActive } from '../meta/actions';
import { dailyChallenge, dailyOptions, type DailyChallenge } from '../meta/daily';
import { useSave } from '../store/save';
import { useOnline } from '../store/online';
import { connect, afterRun } from '../online/session';
import type { RunResults } from '../engine/world';
import { STARTERS } from '../config/meta';
import type { StatSurvivorId } from '../config/survivors';
import { RunScreen } from './screens/RunScreen';
import { Backpack } from './screens/bunker/Backpack';
import { Board } from './screens/bunker/Board';
import {
  Bunker,
  EXPEDITION_TABS,
  STORE_TABS,
  type BunkerView,
  type ExpeditionTab,
  type StoreTab,
} from './screens/bunker/Bunker';
import { Tabs } from './screens/bunker/common';
import { Expedition } from './screens/bunker/Expedition';
import { Merchant } from './screens/bunker/Merchant';
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
  /** Pestaña abierta en Expedición y en Intendencia (se recuerdan al volver al Búnker). */
  const [expTab, setExpTab] = useState<ExpeditionTab>('go');
  const [storeTab, setStoreTab] = useState<StoreTab>('supplies');
  /** Superviviente elegido al salir de expedición; null mientras se elige. */
  const [runChar, setRunChar] = useState<StatSurvivorId | null>(null);
  /** Reto diario en curso (null en una expedición normal). */
  const [daily, setDaily] = useState<DailyChallenge | null>(null);
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

  // Sin test inicial: una partida nueva empieza con todo el plantel y el primero como activo.
  const starterChosen = data.profile.starterChosen;
  useEffect(() => {
    if (!starterChosen) act((d) => chooseStarter(d, STARTERS[0]));
  }, [act, starterChosen]);

  // Misiones del día al abrir y al volver al Búnker (cambian a medianoche local).
  useEffect(() => {
    if (view === 'bunker' || view === 'board') act((d) => refreshDaily(d, new Date()));
  }, [act, view]);

  const runSettings = useMemo(
    () => ({ showDamage: st.damageNumbers, reduceMotion: st.reduceMotion, crt: st.crtFilter }),
    [st.damageNumbers, st.reduceMotion, st.crtFilter],
  );
  const worldOptions = useMemo(
    () => (daily ? dailyOptions(daily) : active ? runOptionsFor(data, active) : undefined),
    [data, active, daily],
  );
  const back = useCallback(() => {
    setRunChar(null);
    setDaily(null);
    setView('bunker');
  }, []);
  const start = useCallback(
    (id: StatSurvivorId) => {
      act((d) => setActive(d, id));
      setDaily(null);
      setRunChar(id);
    },
    [act],
  );
  const startDaily = useCallback(() => {
    const c = dailyChallenge(new Date());
    setDaily(c);
    setRunChar(c.charId);
  }, []);
  const finish = useCallback(
    (r: RunResults) => {
      const reward = act((d) => applyRun(d, r, new Date()));
      afterRun(r);
      return <RunReward reward={reward} />;
    },
    [act],
  );

  const expNav = (
    <Tabs
      ids={EXPEDITION_TABS}
      current={expTab}
      onTab={setExpTab}
      label={(id) => t(id === 'go' ? 'expedition.tabGo' : 'bunker.survivors.cmd')}
    />
  );
  const storeNav = (
    <Tabs ids={STORE_TABS} current={storeTab} onTab={setStoreTab} label={(id) => t(`bunker.${id}.cmd`)} />
  );

  let screen: React.ReactNode;
  if (!starterChosen) screen = null;
  else if (view === 'expedition' && !runChar)
    screen =
      expTab === 'go' ? (
        <Expedition onStart={start} onDaily={startDaily} onBack={back} nav={expNav} />
      ) : (
        <Survivors onBack={back} nav={expNav} />
      );
  else if (view === 'expedition' && runChar)
    screen = (
      <RunScreen
        charId={runChar}
        fixedSeed={daily?.seed}
        settings={runSettings}
        worldOptions={worldOptions}
        onExit={back}
        onFinish={finish}
      />
    );
  else if (view === 'stores') {
    const Store = { workshop: Workshop, supplies: Supplies, merchant: Merchant, backpack: Backpack }[
      storeTab
    ];
    screen = <Store onBack={back} nav={storeNav} />;
  } else if (view === 'tree') screen = <Tree onBack={back} />;
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
