// Taller (02_GAMEPLAY.md §9): árbol pequeño por superviviente. Solo afecta cuando juegas con él.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IMPLANTS, UPGRADES, UPGRADE_IDS, upgradeCost } from '../../../config/meta';
import { STAT_SURVIVOR_IDS, type StatSurvivorId } from '../../../config/survivors';
import { buyUpgrade } from '../../../meta/actions';
import { useSave } from '../../../store/save';
import { upgradeIcon } from '../../icons';
import { Screen } from './common';

export function Workshop({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const data = useSave((s) => s.data);
  const act = useSave((s) => s.act);
  const owned = STAT_SURVIVOR_IDS.filter((id) => data.survivors[id]);
  const [sel, setSel] = useState<StatSurvivorId | null>(data.profile.active);
  const id = sel && data.survivors[sel] ? sel : owned[0];
  const o = id ? data.survivors[id] : undefined;

  return (
    <Screen title={t('bunker.workshop.cmd')} onBack={onBack}>
      <div className="chips" role="tablist">
        {owned.map((c) => (
          <button key={c} role="tab" aria-selected={c === id} className="chip" onClick={() => setSel(c)}>
            {t(`entities.${c}`)}
          </button>
        ))}
      </div>
      {id && o && (
        <>
          <p>{t('workshop.only', { name: t(`entities.${id}`) })}</p>
          <ul className="shop">
            {UPGRADE_IDS.map((u) => {
              const lvl = o.upgrades[u];
              const def = UPGRADES[u];
              const maxed = lvl >= def.max;
              const cost = upgradeCost(u, lvl);
              return (
                <li key={u} className="shop__row">
                  <span>
                    <img className="shop__icon" src={upgradeIcon(u)} alt="" />
                    <strong>{t(`workshop.${u}.name`)}</strong>{' '}
                    <small>{t(`workshop.${u}.desc`, { n: def.per })}</small>
                  </span>
                  <span className="pips" aria-label={`${lvl}/${def.max}`}>
                    {'■'.repeat(lvl)}
                    {'□'.repeat(def.max - lvl)}
                  </span>
                  <button
                    className="btn"
                    disabled={maxed || data.profile.credits < cost}
                    onClick={() => act((d) => buyUpgrade(d, id, u))}
                  >
                    {maxed ? t('workshop.max') : t('bunker.price', { n: cost })}
                  </button>
                </li>
              );
            })}
          </ul>
          <p>
            {t('workshop.implant')}{' '}
            {o.implant
              ? `${t(`implants.${o.implant}`)} (${t('implants.effect', {
                  up: t(`stats.${IMPLANTS[o.implant].up}`),
                  upVal: IMPLANTS[o.implant].upVal,
                  down: t(`stats.${IMPLANTS[o.implant].down}`),
                  downVal: IMPLANTS[o.implant].downVal,
                })})`
              : t('workshop.none')}
          </p>
        </>
      )}
    </Screen>
  );
}
