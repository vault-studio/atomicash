// Mochila: consumibles guardados. Cada expedición se lleva hasta `perRun` de cada uno (+ taller).
import { useTranslation } from 'react-i18next';
import { CONSUMABLE_IDS } from '../../../config/items';
import { BACKPACK, UPGRADES } from '../../../config/meta';
import { useSave } from '../../../store/save';
import { hudIcon } from '../../icons';
import { Screen } from './common';

export function Backpack({ onBack, nav }: { onBack: () => void; nav?: React.ReactNode }) {
  const { t } = useTranslation();
  const data = useSave((s) => s.data);
  const active = data.profile.active ? data.survivors[data.profile.active] : undefined;
  const cap = BACKPACK.perRun + (active?.upgrades.cons ?? 0) * UPGRADES.cons.per;

  return (
    <Screen title={t('bunker.backpack.cmd')} onBack={onBack} nav={nav}>
      <p>{t('backpack.rule', { n: cap })}</p>
      <ul className="shop">
        {CONSUMABLE_IDS.map((c) => {
          const n = data.inventory.consumables[c];
          return (
            <li key={c} className="shop__row">
              <span>
                <img className="shop__icon" src={hudIcon(c)} alt="" />
                <strong>{t(`consumables.${c}.name`)}</strong> <small>{t(`consumables.${c}.desc`)}</small>
              </span>
              <span>
                {t('backpack.have', { n })} · {t('backpack.takes', { n: Math.min(n, cap) })}
              </span>
            </li>
          );
        })}
      </ul>
      <p>{t('backpack.hint')}</p>
    </Screen>
  );
}
