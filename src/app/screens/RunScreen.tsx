import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StatSurvivorId } from '../../config/survivors';
import { startRun, type RunSession } from '../runSession';

const COARSE_POINTER = window.matchMedia('(pointer: coarse)').matches;

interface Props {
  charId: StatSurvivorId;
  onExit: () => void;
}

export function RunScreen({ charId, onExit }: Props) {
  const { t } = useTranslation();
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // La creación de Pixi es asíncrona: si el componente se desmonta antes (StrictMode), se libera al terminar.
    let session: RunSession | null = null;
    let cancelled = false;
    const seed = (Math.random() * 2 ** 31) | 0;
    void startRun(host, charId, seed).then((s) => {
      if (cancelled) s.dispose();
      else {
        session = s;
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
      session?.dispose();
    };
  }, [charId]);

  return (
    <div className="run">
      <div className="run__canvas" ref={hostRef} />
      {!ready && <div className="run__loading">{t('app.loading')}</div>}
      <button className="run__back" onClick={onExit}>
        {t('run.back')}
      </button>
      <div className="run__hint">
        {t(COARSE_POINTER ? 'run.controlsTouch' : 'run.controls')}
        {import.meta.env.DEV && !COARSE_POINTER && <> · {t('run.debugKill')}</>}
      </div>
    </div>
  );
}
