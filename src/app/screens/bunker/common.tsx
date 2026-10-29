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
  children: React.ReactNode;
}

export function Screen({ title, onBack, children }: ScreenProps) {
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
