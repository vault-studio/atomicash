// Pantalla de desarrollo (solo `import.meta.env.DEV`, se monta con `?dev`): la run sin intro ni búnker, sin tocar la
// partida guardada, con el panel del depurador encima. «Reiniciar» remonta RunScreen con otra clave.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RunScreen } from '../screens/RunScreen';
import type { InputOverride, RunSession, RunSettings } from '../runSession';
import { autoChoose, botInput } from '../../sim/sim';
import { DevPanel } from './DevPanel';
import { loadSavedTuning } from './devStorage';
import type { DevCtx, Live, Setup } from './devTypes';
import {
  applyBuild,
  buildWorldOptions,
  formatBuild,
  parseBuild,
  parseDevParams,
  parseSeed,
  randomSeed,
  type BuildItem,
} from './devUtils';
import './dev.css';

const SETTINGS: RunSettings = { showDamage: true, reduceMotion: false, crt: false };

interface Applied {
  key: number;
  char: Setup['char'];
  seed: number;
  build: BuildItem[];
}

function applyLive(s: RunSession, live: Live): void {
  s.world.player.god = live.god;
  s.setSpeed(live.paused ? 0 : live.speed);
}

export function DevApp() {
  const [params] = useState(() => parseDevParams(window.location.search));
  const [savedTuning] = useState(() => loadSavedTuning());
  const [applied, setApplied] = useState<Applied>(() => ({
    key: 0,
    char: params.char,
    seed: params.seed ?? randomSeed(),
    build: params.build,
  }));
  const [setup, setSetup] = useState<Setup>(() => ({
    char: params.char,
    seedText: String(applied.seed),
    fixedSeed: params.seed !== null,
    buildText: formatBuild(params.build),
  }));
  const [live, setLive] = useState<Live>({
    god: params.god,
    speed: params.speed,
    paused: false,
    bot: params.bot,
  });
  const [open, setOpen] = useState(params.panel);

  const sessionRef = useRef<RunSession | null>(null);
  const appliedRef = useRef(applied);
  const liveRef = useRef(live);
  useEffect(() => {
    appliedRef.current = applied;
    liveRef.current = live;
  });

  // F1 muestra/oculta el panel (F3 es del render).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.code !== 'F1') return;
      e.preventDefault();
      setOpen((o) => !o);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Lo que se aplica al instante: invencible, velocidad y pausa.
  useEffect(() => {
    if (sessionRef.current) applyLive(sessionRef.current, live);
  }, [live]);

  // Piloto automático: elige tarjeta con la misma regla que `npm run sim`.
  useEffect(() => {
    if (!live.bot) return;
    const id = setInterval(() => {
      const w = sessionRef.current?.world;
      if (w?.choice && !w.victory && !w.over) autoChoose(w);
    }, 100);
    return () => clearInterval(id);
  }, [live.bot]);

  const inputOverride = useCallback<InputOverride>((w, out) => {
    const bot = liveRef.current.bot;
    if (!bot) return false;
    botInput(w, bot, out);
    return true;
  }, []);

  const onSession = useCallback((s: RunSession) => {
    sessionRef.current = s;
    applyBuild(s.world, appliedRef.current.build);
    applyLive(s, liveRef.current);
  }, []);

  const getSession = useCallback(() => sessionRef.current, []);

  const restart = useCallback(() => {
    const build = parseBuild(setup.buildText).items;
    const seed = setup.fixedSeed ? (parseSeed(setup.seedText) ?? randomSeed()) : randomSeed();
    setSetup((s) => ({ ...s, seedText: String(seed), buildText: formatBuild(build) }));
    setApplied((a) => ({ key: a.key + 1, char: setup.char, seed, build }));
  }, [setup]);

  const patchSetup = useCallback((p: Partial<Setup>) => setSetup((s) => ({ ...s, ...p })), []);
  const patchLive = useCallback((p: Partial<Live>) => setLive((l) => ({ ...l, ...p })), []);

  const worldOptions = useMemo(() => buildWorldOptions(applied.build), [applied.build]);

  const ctx: DevCtx = {
    getSession,
    seed: applied.seed,
    setup,
    patchSetup,
    live,
    patchLive,
    restart,
    savedTuning,
  };

  return (
    <>
      <RunScreen
        key={applied.key}
        charId={applied.char}
        fixedSeed={applied.seed}
        settings={SETTINGS}
        worldOptions={worldOptions}
        onExit={restart}
        onSession={onSession}
        inputOverride={inputOverride}
        noLoader
      />
      {open && <DevPanel ctx={ctx} onClose={() => setOpen(false)} />}
    </>
  );
}
