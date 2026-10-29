import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StatSurvivorId } from '../../config/survivors';
import type { Choice, World } from '../../engine/types';
import type { RunResults, WorldOptions } from '../../engine/world';
import { startRun, type HudSnapshot, type RunSession, type RunSettings } from '../runSession';
import { Cards } from './run/Cards';
import { Hud } from './run/Hud';
import { PauseStats } from './run/PauseStats';
import { Results } from './run/Results';
import { Weld } from './run/Weld';
import type { WeaponId } from '../../config/weapons';

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
}

export function RunScreen({ charId, fixedSeed, settings, worldOptions, onExit, onFinish }: Props) {
  const { t } = useTranslation();
  const hostRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<RunSession | null>(null);
  const [ready, setReady] = useState(false);
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [choice, setChoice] = useState<Choice | null>(null);
  // Cada elección nueva remonta las tarjetas (la tragaperras de los cofres vuelve a girar).
  const [choiceKey, setChoiceKey] = useState(0);
  const [weld, setWeld] = useState<WeaponId | null>(null);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<{ r: RunResults; extra: React.ReactNode } | null>(null);
  // Cambiar la clave reinicia la run sin recargar la página (F1-09).
  const [runKey, setRunKey] = useState(0);
  const [seed, setSeed] = useState(() => fixedSeed ?? (Math.random() * 2 ** 31) | 0);
  const [world, setWorld] = useState<World | null>(null);
  const settingsRef = useRef(settings);
  const optionsRef = useRef(worldOptions);
  const finishRef = useRef(onFinish);
  useEffect(() => {
    settingsRef.current = settings;
    optionsRef.current = worldOptions;
    finishRef.current = onFinish;
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
    void startRun(
      host,
      { charId, seed, settings: settingsRef.current, ...optionsRef.current },
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
        setWorld(s.world);
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
      session?.dispose();
      sessionRef.current = null;
    };
  }, [charId, runKey, seed]);

  useEffect(() => {
    sessionRef.current?.apply(settings);
  }, [settings]);

  useEffect(() => {
    sessionRef.current?.setPaused(paused || weld !== null);
  }, [paused, weld]);

  // Pausa con Esc/P y al perder el foco de la pestaña.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.code === 'Escape' || e.code === 'KeyP') && !result && !choice) setPaused((p) => !p);
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
  }, [result, choice]);

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
      {!ready && <div className="run__loading">{t('app.loading')}</div>}
      {ready && hud && world && <Hud hud={hud} world={world} onPause={pause} onConsume={consume} />}
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
      {paused && !result && (
        <div className="overlay overlay--pause" role="dialog" aria-modal="true">
          <h2 className="overlay__title">{t('run.paused')}</h2>
          {world && <PauseStats world={world} />}
          <div className="overlay__actions">
            <button className="btn btn--primary" autoFocus onClick={() => setPaused(false)}>
              {t('run.resume')}
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
