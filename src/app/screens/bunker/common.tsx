// Piezas comunes de las pantallas del Búnker: marco de terminal, estrellas y colores de rareza.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { STARS } from '../../../config/meta';
import type { SurvivorRarity } from '../../../config/survivors';
import { useSaveData } from '../../../store/save';

/** Borde por rareza (04_ART_UI.md §2): gris / azul / morado / dorado. */
export const RARITY_COLOR: Record<SurvivorRarity, string> = {
  common: '#9a9a8a',
  rare: '#4a8cff',
  epic: '#b05cff',
  legendary: '#ffc83a',
};

interface ScreenProps {
  title: string;
  onBack?: () => void;
  /** Botones al final de la cabecera, tras los cupones. */
  actions?: React.ReactNode;
  /** Pestañas bajo la cabecera (pantallas que agrupan varias secciones). */
  nav?: React.ReactNode;
  children: React.ReactNode;
}

export function Screen({ title, onBack, actions, nav, children }: ScreenProps) {
  const { t } = useTranslation();
  const credits = useSaveData((d) => d.profile.credits);
  return (
    <main className="terminal">
      <header className="terminal__head">
        {onBack && (
          <button className="term-btn" onClick={onBack}>
            {t('bunker.back')}
          </button>
        )}
        <h1>{title}</h1>
        <span className="credits">{t('bunker.credits', { n: credits })}</span>
        {actions}
      </header>
      {nav}
      {children}
    </main>
  );
}

export function Stars({ n }: { n: number }) {
  return (
    <span className="stars" aria-label={`${n}/${STARS.max}`}>
      {'★'.repeat(n)}
      <span className="stars__off">{'★'.repeat(STARS.max - n)}</span>
    </span>
  );
}

/** Tiempo hasta la medianoche local (HH:MM): cuándo rotan el mercader y las misiones. */
export function untilMidnight(now: Date): string {
  const m = new Date(now);
  m.setHours(24, 0, 0, 0);
  const s = Math.max(0, Math.floor((m.getTime() - now.getTime()) / 1000));
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}`;
}

/**
 * Ventana flotante de ayuda: diálogo modal centrado con el fondo oscurecido y estilo de terminal. Se cierra con su
 * botón, pulsando fuera y con Escape.
 */
export function InfoDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return createPortal(
    <div className="infod" onClick={onClose}>
      <div
        className="infod__box"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="infod__head">
          <h2>{title}</h2>
          <button className="term-btn infod__close" autoFocus onClick={onClose}>
            {t('info.close')}
          </button>
        </header>
        <div className="infod__body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/** Botón «i» redondo para la esquina de la cabecera de un bloque; abre un `InfoDialog` con `children`. */
export function InfoButton({ title, children }: { title: string; children: React.ReactNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="info-btn"
        aria-label={t('info.open', { name: title })}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        i
      </button>
      {open && (
        <InfoDialog title={title} onClose={() => setOpen(false)}>
          {children}
        </InfoDialog>
      )}
    </>
  );
}

/** Cabecera de un bloque grande: título y, a la derecha, su botón «i» con la ventana de ayuda (si la tiene). */
export function BlockHead({ title, info }: { title: string; info?: React.ReactNode }) {
  return (
    <div className="sheet__bhead">
      <h3>{title}</h3>
      {info && <InfoButton title={title}>{info}</InfoButton>}
    </div>
  );
}
