import { useEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { audio } from '../../audio/audio';
import { ASH } from './intro/cloud';
import { Bomb, Logo, TearFilters, Typed } from './intro/parts';

/** Momento del impacto de la bomba en ms; styles/intro/ lo recibe como `--impact`. */
const IMPACT_MS = 2000;
/** A partir de aquí el tubo se apaga (raya y punto) y la intro se quita al terminar. */
const INTRO_FADE_MS = 6000;
const INTRO_END_MS = 6600;
/** El subtítulo se escribe cuando el hongo ya se ha enfriado. */
const SUBTITLE_AT_MS = IMPACT_MS + 1300;

interface IntroProps {
  onDone: () => void;
}

/** Arranque del juego. El navegador no deja sonar nada antes del primer gesto, así que el monitor espera apagado
 *  a que se pulse: ese toque desbloquea el audio (main.tsx), arranca la música del menú y enciende la intro.
 *  DECISIÓN: se atiende el click y no pointerup: si la intro se quita antes, ese click cae en el menú de debajo. Por
 *  lo mismo se cancela la tecla, que si no pulsaría el botón del menú que tiene el foco. */
export function Intro({ onDone }: IntroProps) {
  const { t } = useTranslation();
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (on) return;
    const power = (e: KeyboardEvent): void => {
      e.preventDefault();
      setOn(true);
    };
    window.addEventListener('keydown', power);
    return () => window.removeEventListener('keydown', power);
  }, [on]);

  if (on) return <IntroShow onDone={onDone} />;
  return (
    <div className="intro intro--off" onClick={() => setOn(true)}>
      <div className="intro__power">{t('app.introPower')}</div>
      <div className="intro__glass" />
    </div>
  );
}

/** El monitor de búnker encendido: cae una bomba en el hueco de la T de «ATOMIC ASH» y su hongo se queda como la
 *  T. Se salta con un toque o una tecla. */
function IntroShow({ onDone }: IntroProps) {
  const { t } = useTranslation();
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const boom = setTimeout(() => audio.play('boom', 4), IMPACT_MS);
    const fade = setTimeout(() => setLeaving(true), INTRO_FADE_MS);
    const end = setTimeout(onDone, INTRO_END_MS);
    const skip = (e: KeyboardEvent): void => {
      e.preventDefault();
      onDone();
    };
    window.addEventListener('keydown', skip);
    return () => {
      clearTimeout(boom);
      clearTimeout(fade);
      clearTimeout(end);
      window.removeEventListener('keydown', skip);
    };
  }, [onDone]);

  return (
    <div
      className={`intro${leaving ? ' intro--leaving' : ''}`}
      style={{ '--impact': `${IMPACT_MS}ms` } as CSSProperties}
      onClick={onDone}
    >
      <TearFilters />
      <div className="intro__screen">
        <div className="intro__picture">
          <div className="intro__boot" aria-hidden="true">
            <Typed text={t('app.introBoot')} at={300} />
            <Typed text={t('app.introAlert')} at={850} className="intro__alert" />
          </div>
          <div className="intro__stage">
            <h1 className="intro__title" aria-label={t('app.title')}>
              <Logo />
              <Bomb />
            </h1>
            <p className="intro__sub">
              <Typed text={t('app.tagline')} at={SUBTITLE_AT_MS} />
            </p>
          </div>
          <div className="intro__ashes" aria-hidden="true">
            {ASH.map((style, i) => (
              <span key={i} className="intro__ash" style={style} />
            ))}
          </div>
          <div className="intro__flash" />
          <div className="intro__tint" />
        </div>
        <div className="intro__static" />
        <div className="intro__burst" />
        <div className="intro__roll" />
        <div className="intro__beam" />
      </div>
      <div className="intro__glass" />
    </div>
  );
}
