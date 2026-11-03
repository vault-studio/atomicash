// Intendencia: una sola pantalla con una ficha grande por consumible. Se compran por paquetes con cupones y, al
// salir de expedición, el superviviente activo se lleva hasta `BACKPACK.perRun` (+ su Riñonera) de cada uno.
import { useTranslation } from 'react-i18next';
import { CONSUMABLE_IDS } from '../../../config/items';
import { BACKPACK, MERCHANT, UPGRADES } from '../../../config/meta';
import { buyConsumable } from '../../../meta/actions';
import { useSave, useSaveData } from '../../../store/save';
import { hudIcon } from '../../icons';

export function Stores({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const credits = useSaveData((d) => d.profile.credits);
  const stock = useSaveData((d) => d.inventory.consumables);
  const cons = useSaveData((d) => {
    const a = d.profile.active;
    return a ? (d.survivors[a]?.upgrades.cons ?? 0) : 0;
  });
  const act = useSave((s) => s.act);
  const cap = BACKPACK.perRun + cons * UPGRADES.cons.per;

  return (
    <main className="sheet stores">
      <header className="sheet__head">
        <button className="term-btn" onClick={onBack}>
          {t('bunker.back')}
        </button>
        <h1>{t('bunker.stores.cmd')}</h1>
        <span className="credits sheet__credits">{t('bunker.credits', { n: credits })}</span>
      </header>
      <p className="stores__rule">{t('stores.rule', { n: cap })}</p>
      <div className="stores__grid">
        {CONSUMABLE_IDS.map((c) => {
          const n = stock[c];
          const price = MERCHANT.consumablePrice[c] * MERCHANT.consumablePack;
          return (
            <section key={c} className="sheet__block stores__card">
              <img className="stores__icon" src={hudIcon(c)} alt="" />
              <h3>{t(`consumables.${c}.name`)}</h3>
              <p className="stores__desc">{t(`consumables.${c}.desc`)}</p>
              <div className="stores__foot">
                <p className="stores__count">
                  <span>
                    <b>{n}</b> {t('stores.have')}
                  </span>
                  <span>
                    <b>{Math.min(n, cap)}</b> {t('stores.takes')}
                  </span>
                </p>
                <button
                  className="btn btn--primary stores__buy"
                  disabled={credits < price}
                  onClick={() => act((d) => buyConsumable(d, c))}
                >
                  {t('stores.buy', { qty: MERCHANT.consumablePack, price })}
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
