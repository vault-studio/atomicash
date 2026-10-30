// Mercader ambulante (02_GAMEPLAY.md §9): consumibles, implantes y manuales; rota a medianoche local.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IMPLANTS } from '../../../config/meta';
import { buyOffer, isSoldOut, merchantStock, type Offer } from '../../../meta/actions';
import { useSave } from '../../../store/save';
import { hudIcon, weaponIcon } from '../../icons';
import { Screen, untilMidnight } from './common';

export function Merchant({ onBack, nav }: { onBack: () => void; nav?: React.ReactNode }) {
  const { t } = useTranslation();
  const data = useSave((s) => s.data);
  const act = useSave((s) => s.act);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const stock = merchantStock(data, now);
  const active = data.profile.active;

  const label = (o: Offer): React.ReactNode => {
    switch (o.kind) {
      case 'consumable':
        return (
          <>
            <img className="shop__icon" src={hudIcon(o.id)} alt="" />
            <strong>
              {t(`consumables.${o.id}.name`)} ×{o.qty}
            </strong>{' '}
            <small>{t(`consumables.${o.id}.desc`)}</small>
          </>
        );
      case 'implant': {
        const im = IMPLANTS[o.id];
        return (
          <>
            <strong>{t(`implants.${o.id}`)}</strong>{' '}
            <small>
              {t('implants.effect', {
                up: t(`stats.${im.up}`),
                upVal: im.upVal,
                down: t(`stats.${im.down}`),
                downVal: im.downVal,
              })}{' '}
              · {active ? t('merchant.forActive', { name: t(`entities.${active}`) }) : ''}
            </small>
          </>
        );
      }
      case 'manual':
        return (
          <>
            <img className="shop__icon" src={weaponIcon(o.weapon)} alt="" />
            <strong>{t('merchant.manual', { weapon: t(`weapons.${o.weapon}.name`) })}</strong>{' '}
            <small>{t('merchant.manualFor', { name: t(`entities.${o.char}`) })}</small>
          </>
        );
    }
  };

  return (
    <Screen title={t('bunker.merchant.cmd')} onBack={onBack} nav={nav}>
      <p>{t('merchant.restock', { time: untilMidnight(now) })}</p>
      <ul className="shop">
        {stock.map((o) => {
          const sold = isSoldOut(data, o, now);
          return (
            <li key={o.key} className="shop__row">
              <span>{label(o)}</span>
              <button
                className="btn"
                disabled={sold || data.profile.credits < o.price}
                onClick={() => act((d) => buyOffer(d, o.key, new Date()))}
              >
                {sold ? t('merchant.sold') : t('bunker.price', { n: o.price })}
              </button>
            </li>
          );
        })}
      </ul>
    </Screen>
  );
}
