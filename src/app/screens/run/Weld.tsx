// Pantalla de Apaño (02_GAMEPLAY.md §5): las dos armas se sueldan en una, con chispas.
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FUSIONS, WEAPONS, type WeaponId } from '../../../config/weapons';
import { weaponParams } from '../../cardText';
import { PLAYER } from '../../../config/run';

interface Props {
  result: WeaponId;
  onDone: () => void;
}

const SPARKS = 14;

export function Weld({ result, onDone }: Props) {
  const { t } = useTranslation();
  const f = FUSIONS.find((x) => x.result === result);

  useEffect(() => {
    const id = window.setTimeout(onDone, 2600);
    const onKey = (e: KeyboardEvent): void => {
      if (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape') onDone();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('keydown', onKey);
    };
  }, [onDone]);

  if (!f) return null;
  return (
    <div className="overlay weld" role="dialog" aria-modal="true" onClick={onDone}>
      <h2 className="overlay__title">{t('cards.fusion')}!</h2>
      <div className="weld__bench">
        <span className="weld__part weld__part--a" style={{ borderColor: WEAPONS[f.a].color }}>
          {t(`weapons.${f.a}.short`)}
        </span>
        <span className="weld__torch" aria-hidden="true">
          {Array.from({ length: SPARKS }, (_, i) => (
            <i
              key={i}
              style={
                { '--a': `${(i / SPARKS) * 360}deg`, '--d': `${(i % 5) * 0.07}s` } as React.CSSProperties
              }
            />
          ))}
        </span>
        <span className="weld__part weld__part--b" style={{ borderColor: WEAPONS[f.b].color }}>
          {t(`weapons.${f.b}.short`)}
        </span>
      </div>
      <div className="weld__result" style={{ borderColor: WEAPONS[result].color }}>
        <strong>{t(`weapons.${result}.name`)}</strong>
        <span>{t(`weapons.${result}.desc`, weaponParams(result, PLAYER.maxWeaponLevel))}</span>
      </div>
    </div>
  );
}
