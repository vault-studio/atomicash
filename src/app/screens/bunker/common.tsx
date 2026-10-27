// Piezas comunes de las pantallas del Búnker: marco de terminal y ficha de superviviente.
import { useTranslation } from 'react-i18next';
import { ENTITIES } from '../../../config/entities';
import { STARS } from '../../../config/meta';
import { SURVIVORS, type StatSurvivorId, type SurvivorRarity } from '../../../config/survivors';
import type { OwnedSurvivor } from '../../../meta/save';
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

interface CardProps {
  id: StatSurvivorId;
  owned?: OwnedSurvivor;
  active?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}

/** Ficha de empleado: color, nombre, rareza, estrellas y nivel. Los no reclutados salen en sombra. */
export function SurvivorCard({ id, owned, active, onClick, children }: CardProps) {
  const { t } = useTranslation();
  const rarity = SURVIVORS[id].rarity;
  const cls = ['card', 'card--survivor', owned?.irradiated ? 'is-irradiated' : '', active ? 'is-active' : '']
    .filter(Boolean)
    .join(' ');
  const body = (
    <>
      <span className="card__swatch" style={{ background: owned ? ENTITIES[id].color : '#333' }} />
      <strong>{owned ? t(`entities.${id}`) : t('collection.unknown')}</strong>
      <small style={{ color: RARITY_COLOR[rarity] }}>{t(`rarity.${rarity}`)}</small>
      {owned && (
        <small>
          <Stars n={owned.stars} /> · {t('collection.level', { n: owned.level })}
          {owned.irradiated && <> · {t('collection.irradiated')}</>}
        </small>
      )}
      {children}
    </>
  );
  return onClick ? (
    <button className={cls} style={{ borderColor: RARITY_COLOR[rarity] }} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className={cls} style={{ borderColor: RARITY_COLOR[rarity] }}>
      {body}
    </div>
  );
}
