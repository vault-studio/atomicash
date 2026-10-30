// Piezas comunes de las pantallas del Búnker: marco de terminal, estrellas y colores de rareza.
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
  /** Pestañas bajo la cabecera (pantallas que agrupan varias secciones). */
  nav?: React.ReactNode;
  children: React.ReactNode;
}

export function Screen({ title, onBack, nav, children }: ScreenProps) {
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
      </header>
      {nav}
      {children}
    </main>
  );
}

interface TabsProps<T extends string> {
  ids: readonly T[];
  current: T;
  onTab: (id: T) => void;
  label: (id: T) => string;
}

/** Pestañas de una pantalla agrupada (Expedición, Intendencia). */
export function Tabs<T extends string>({ ids, current, onTab, label }: TabsProps<T>) {
  return (
    <nav className="tabs" role="tablist">
      {ids.map((id) => (
        <button
          key={id}
          role="tab"
          aria-selected={id === current}
          className="tabs__tab"
          onClick={() => onTab(id)}
        >
          {label(id)}
        </button>
      ))}
    </nav>
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
