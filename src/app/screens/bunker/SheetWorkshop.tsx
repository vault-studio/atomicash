// Pestaña Taller de la ficha del personaje: todo lo que se compra con cupones para él. Tres bloques grandes con el
// estilo de la ficha: mejoras, implante y arsenal de armas iniciales.
import { useTranslation } from 'react-i18next';
import { IMPLANTS, IMPLANT_IDS, MERCHANT, UPGRADES, UPGRADE_IDS, upgradeCost } from '../../../config/meta';
import { SURVIVORS, type RosterId } from '../../../config/survivors';
import { buyImplant, buyUpgrade, learnStarter, learnableStarters, setStarter } from '../../../meta/actions';
import { useSave, useSaveData } from '../../../store/save';
import { upgradeIcon, weaponIcon } from '../../icons';
import { BlockHead } from './common';

export function SheetWorkshop({ id }: { id: RosterId }) {
  const { t } = useTranslation();
  const o = useSaveData((d) => d.survivors[id]);
  const credits = useSaveData((d) => d.profile.credits);
  const act = useSave((s) => s.act);
  if (!o) return null;

  const base = SURVIVORS[id].weapon;
  const starter = o.starter ?? base;
  const arsenal = [base, ...learnableStarters(id)];

  return (
    <div className="sheet__cols sheet__cols--shop">
      <section className="sheet__block sheet__block--list sheet__block--tall">
        <BlockHead title={t('sheet.upgrades')} />
        <p className="sheet__hint">{t('sheet.upgradesHint')}</p>
        <ul className="wk">
          {UPGRADE_IDS.map((u) => {
            const lvl = o.upgrades[u];
            const def = UPGRADES[u];
            const maxed = lvl >= def.max;
            const cost = upgradeCost(u, lvl);
            return (
              <li key={u} className="wk__row">
                <img className="wk__icon" src={upgradeIcon(u)} alt="" />
                <span className="wk__text">
                  <strong>{t(`workshop.${u}.name`)}</strong>
                  <small>{t(`workshop.${u}.desc`, { n: def.per })}</small>
                  <span className="pips" aria-label={`${lvl}/${def.max}`}>
                    {'■'.repeat(lvl)}
                    {'□'.repeat(def.max - lvl)}
                  </span>
                </span>
                <button
                  className="btn wk__btn"
                  disabled={maxed || credits < cost}
                  onClick={() => act((d) => buyUpgrade(d, id, u))}
                >
                  {maxed ? t('workshop.max') : t('bunker.price', { n: cost })}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="sheet__block sheet__block--list">
        <BlockHead title={t('sheet.implant')} />
        <p className="sheet__hint">
          {o.implant
            ? t('workshop.implantNow', { name: t(`implants.${o.implant}`) })
            : t('workshop.implantNone')}
        </p>
        <ul className="wk">
          {IMPLANT_IDS.map((im) => {
            const def = IMPLANTS[im];
            const current = o.implant === im;
            return (
              <li key={im} className={current ? 'wk__row is-current' : 'wk__row'}>
                <span className="wk__text">
                  <strong>{t(`implants.${im}`)}</strong>
                  <small>
                    {t('implants.effect', {
                      up: t(`stats.${def.up}`),
                      upVal: def.upVal,
                      down: t(`stats.${def.down}`),
                      downVal: def.downVal,
                    })}
                  </small>
                </span>
                <button
                  className="btn wk__btn"
                  disabled={current || credits < def.price}
                  onClick={() => act((d) => buyImplant(d, id, im))}
                >
                  {current ? t('workshop.installed') : t('bunker.price', { n: def.price })}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="sheet__block sheet__block--list">
        <BlockHead title={t('sheet.arsenal')} />
        <p className="sheet__hint">{t('sheet.arsenalHint')}</p>
        <ul className="wk">
          {arsenal.map((w) => {
            const learned = w === base || o.learnedStarters.includes(w);
            const current = w === starter;
            return (
              <li key={w} className={current ? 'wk__row is-current' : 'wk__row'}>
                <img className="wk__icon" src={weaponIcon(w)} alt="" />
                <span className="wk__text">
                  <strong>{t(`weapons.${w}.name`)}</strong>
                  <small>{learned ? t('workshop.learned') : t('workshop.notLearned')}</small>
                </span>
                {learned ? (
                  <button
                    className="btn wk__btn"
                    disabled={current}
                    onClick={() => act((d) => setStarter(d, id, w))}
                  >
                    {current ? t('workshop.inUse') : t('workshop.use')}
                  </button>
                ) : (
                  <button
                    className="btn wk__btn"
                    disabled={credits < MERCHANT.manualPrice}
                    onClick={() => act((d) => learnStarter(d, id, w))}
                  >
                    {t('bunker.price', { n: MERCHANT.manualPrice })}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
