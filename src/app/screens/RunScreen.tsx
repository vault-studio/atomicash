import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TEST_PHASE } from '../../config/run';
import type { StatSurvivorId } from '../../config/survivors';
import type { Choice, World } from '../../engine/types';
import type { RunResults, WorldOptions } from '../../engine/world';
import {
  startRun,
  type HudSnapshot,
  type InputOverride,
  type RunSession,
  type RunSettings,
} from '../runSession';
import { Cards } from './run/Cards';
import { Hud } from './run/Hud';
import { MapView } from './run/MapView';
import { PauseStats } from './run/PauseStats';
import { Results } from './run/Results';
import { Weld } from './run/Weld';
import { ExpeditionLoader } from './ExpeditionLoader';
import type { WeaponId } from '../../config/weapons';

/** El hongo de la carga se ve al menos esto (ms), con la run en pausa detrás. */
const LOADER_MIN_MS = 2600;
/** Fundido de salida del hongo (cuadra con .nukeload en nuke.css). */
const LOADER_FADE_MS = 400;

const COARSE_POINTER = window.matchMedia('(pointer: coarse)').matches;

interface Props {
  charId: StatSurvivorId;
  /** Semilla fija (reto diario): «Revancha» repite la misma. */
  fixedSeed?: number;
  settings: RunSettings;
  /** Bonus del taller, mochila y mercader (F3). */
  worldOptions?: WorldOptions;
  onExit: () => void;
  /** Se llama una vez al terminar cada run (para guardar progreso). Devuelve contenido extra del ticket. */
  onFinish?: (r: RunResults) => React.ReactNode;
  /** Depurador: se llama con la sesión recién creada, antes del primer paso. */
  onSession?: (s: RunSession) => void;
  /** Depurador: sustituye a la entrada del jugador. */
  inputOverride?: InputOverride;
  /** Depurador: sin hongo de carga, la run empieza al instante. */
  noLoader?: boolean;
}

export function RunScreen({
  charId,
  fixedSeed,
  settings,
  worldOptions,
  onExit,
  onFinish,
  onSession,
  inputOverride,
  noLoader,
}: Props) {
  const { t } = useTranslation();
  const hostRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<RunSession | null>(null);
  const [ready, setReady] = useState(false);
  /** Hongo de carga: tapa al menos LOADER_MIN_MS y hasta que la run esté lista; luego se funde y se quita. */
  const [minDone, setMinDone] = useState(false);
  const [loaderGone, setLoaderGone] = useState(false);
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [choice, setChoice] = useState<Choice | null>(null);
  // Cada elección nueva remonta las tarjetas (la tragaperras de los cofres vuelve a girar).
  const [choiceKey, setChoiceKey] = useState(0);
  const [weld, setWeld] = useState<WeaponId | null>(null);
  const [paused, setPaused] = useState(false);
  const [map, setMap] = useState(false);
  const [result, setResult] = useState<{ r: RunResults; extra: React.ReactNode } | null>(null);
  // Cambiar la clave reinicia la run sin recargar la página (F1-09).
  const [runKey, setRunKey] = useState(0);
  const [seed, setSeed] = useState(() => fixedSeed ?? (Math.random() * 2 ** 31) | 0);
  const [world, setWorld] = useState<World | null>(null);
  const settingsRef = useRef(settings);
  const optionsRef = useRef(worldOptions);
  const finishRef = useRef(onFinish);
  const sessionCbRef = useRef(onSession);
  const overrideRef = useRef(inputOverride);
  useEffect(() => {
    settingsRef.current = settings;
    optionsRef.current = worldOptions;
    finishRef.current = onFinish;
    sessionCbRef.current = onSession;
    overrideRef.current = inputOverride;
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // La creación de Pixi es asíncrona: si el componente se desmonta antes (StrictMode), se libera al terminar.
    let session: RunSession | null = null;
    let cancelled = false;
    setReady(false);
    setResult(null);
    setChoice(null);
    setPaused(false);
    setMap(false);
    setMinDone(!!noLoader);
    setLoaderGone(!!noLoader);
    const minTimer = noLoader ? undefined : setTimeout(() => setMinDone(true), LOADER_MIN_MS);
    void startRun(
      host,
      {
        charId,
        seed,
        settings: settingsRef.current,
        ...optionsRef.current,
        inputOverride: overrideRef.current,
      },
      {
        onHud: setHud,
        onChoice: (c) => {
          setChoice(c);
          setChoiceKey((k) => k + 1);
        },
        onEnd: (r) => setResult({ r, extra: finishRef.current?.(r) ?? null }),
      },
    ).then((s) => {
      if (cancelled) s.dispose();
      else {
        session = s;
        sessionRef.current = s;
        sessionCbRef.current?.(s);
        setWorld(s.world);
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
      clearTimeout(minTimer);
      session?.dispose();
      sessionRef.current = null;
    };
  }, [charId, runKey, seed, noLoader]);

  useEffect(() => {
    sessionRef.current?.apply(settings);
  }, [settings]);

  const loaded = ready && minDone;
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => setLoaderGone(true), LOADER_FADE_MS);
    return () => clearTimeout(t);
  }, [loaded]);

  useEffect(() => {
    sessionRef.current?.setPaused(paused || weld !== null || !loaded);
  }, [paused, weld, loaded, ready]);

  // Pausa con Esc/P y al perder el foco de la pestaña.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.code !== 'Escape' && e.code !== 'KeyP') || result || choice) return;
      // Con el mapa abierto se vuelve a la pausa, no a la partida.
      if (map) setMap(false);
      else setPaused((p) => !p);
    };
    const onBlur = (): void => {
      if (!result) setPaused(true);
    };
    const onVis = (): void => {
      if (document.hidden) onBlur();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [result, choice, map]);

  const pick = useCallback((i: number) => {
    const s = sessionRef.current;
    if (!s) return;
    const c = s.world.choice?.cards[i];
    s.choose(i);
    // El Apaño tiene pantalla propia; la run sigue en pausa mientras se ve.
    if (c?.kind === 'fusion') setWeld(c.id);
  }, []);
  const endWeld = useCallback(() => setWeld(null), []);
  const consume = useCallback((i: number) => sessionRef.current?.consume(i), []);
  const spawnColossus = useCallback(() => sessionRef.current?.spawnColossus(), []);
  const pause = useCallback(() => setPaused(true), []);
  const doReroll = useCallback(() => sessionRef.current?.reroll(), []);
  const banish = useCallback((i: number) => sessionRef.current?.banish(i), []);
  const lock = useCallback((i: number) => sessionRef.current?.lock(i), []);
  const again = (): void => {
    setSeed(fixedSeed ?? (Math.random() * 2 ** 31) | 0);
    setRunKey((k) => k + 1);
  };

  return (
    <div className="run">
      <div className="run__canvas" ref={hostRef} />
      {!loaderGone && !noLoader && <ExpeditionLoader leaving={loaded} />}
      {ready && hud && world && <Hud hud={hud} world={world} onPause={pause} onConsume={consume} />}
      {TEST_PHASE && ready && !result && !choice && !paused && (
        // Fase de test: saca al Coloso en cualquier momento. tabIndex -1 para que el espacio no lo vuelva a pulsar.
        <button className="run__test" tabIndex={-1} onClick={spawnColossus}>
          {t('run.testColossus')}
        </button>
      )}
      {ready && hud && hud.time < 8 && (
        <div className="run__hint">
          {t(COARSE_POINTER ? 'run.controlsTouch' : 'run.controls')}
          {import.meta.env.DEV && !COARSE_POINTER && <> · {t('run.debugKill')}</>}
        </div>
      )}
      {weld && !result && <Weld result={weld} onDone={endWeld} />}
      {choice && world && !result && !weld && (
        <Cards
          key={choiceKey}
          choice={choice}
          world={world}
          onPick={pick}
          onReroll={doReroll}
          onBanish={banish}
          onLock={lock}
        />
      )}
      {paused && !result && map && world && <MapView world={world} onClose={() => setMap(false)} />}
      {paused && !result && !map && (
        <div className="overlay overlay--pause" role="dialog" aria-modal="true">
          <h2 className="overlay__title">{t('run.paused')}</h2>
          {world && <PauseStats world={world} />}
          <div className="overlay__actions">
            <button className="btn btn--primary" autoFocus onClick={() => setPaused(false)}>
              {t('run.resume')}
            </button>
            <button className="btn" onClick={() => setMap(true)}>
              {t('run.map')}
            </button>
            <button className="btn" onClick={onExit}>
              {t('run.abandon')}
            </button>
          </div>
        </div>
      )}
      {result && <Results r={result.r} seed={seed} extra={result.extra} onAgain={again} onMenu={onExit} />}
    </div>
  );
}
