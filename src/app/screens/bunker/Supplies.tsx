// Cajas de suministros (02_GAMEPLAY.md §9): solo con créditos, probabilidades siempre visibles y garantía.
// La caja es la protagonista: se agita, se abre con un destello del color de lo mejor que trae y reparte las fichas.
import { useEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GACHA,
  PULL_SIZES,
  RARITIES,
  topRarity,
  zoneRarities,
  zoneRates,
  type PullSize,
} from '../../../config/meta';
import { SURVIVORS, type StatSurvivorId } from '../../../config/survivors';
import { audio } from '../../../audio/audio';
import { pullBoxes, type Grant } from '../../../meta/actions';
import { useSave } from '../../../store/save';
import { pickupIcon } from '../../icons';
import { RARITY_COLOR, Screen } from './common';
import { headOf } from './Portraits';

const ZONE = 'paramo' as const;
const OPEN_MS = 1400;
/** Retraso entre ficha y ficha al repartirlas (las tiradas grandes, más rápido). */
const DEAL_MS = { 1: 0, 10: 90, 100: 12 } as const satisfies Record<PullSize, number>;
// Solo las rarezas que tiene la caja, con sus probabilidades reales.
const RARITIES_HERE = zoneRarities(ZONE);
const RATES = zoneRates(ZONE);
const POOL = GACHA.pool[ZONE] as readonly StatSurvivorId[];

const rarityVar = (c: string): CSSProperties => ({ '--rarity': c }) as CSSProperties;

/** La mejor rareza de una tirada: tiñe el destello de la caja. */
function bestOf(res: readonly Grant[]): Grant['rarity'] {
  let best = 0;
  for (const g of res) best = Math.max(best, RARITIES.indexOf(g.rarity));
  return RARITIES[best] ?? 'common';
}

/** Ficha de un superviviente sacado de la caja. */
function PullCard({ g, delay }: { g: Grant; delay: number }) {
  const { t } = useTranslation();
  const head = headOf(g.id);
  const cls = ['pull', g.isNew && 'is-new', g.irradiated && 'is-irradiated', `is-${g.rarity}`]
    .filter(Boolean)
    .join(' ');
  return (
    <li className={cls} style={{ ...rarityVar(RARITY_COLOR[g.rarity]), animationDelay: `${delay}ms` }}>
      <span className="pull__art">{head && <img src={head} alt="" />}</span>
      <strong className="pull__name">{t(`entities.${g.id}`)}</strong>
      <small className="pull__note">
        {g.isNew ? t('supplies.new') : t('supplies.dup', { n: g.shards })}
        {g.irradiated && <> · ☢</>}
      </small>
      {g.isNew && <span className="pull__stamp">{t('supplies.new')}</span>}
    </li>
  );
}

export function Supplies({ onBack, nav }: { onBack: () => void; nav?: React.ReactNode }) {
  const { t } = useTranslation();
  const data = useSave((s) => s.data);
  const act = useSave((s) => s.act);
  const [res, setRes] = useState<{ grants: Grant[]; size: PullSize } | null>(null);
  const [opening, setOpening] = useState(false);
  const since = data.gacha.pity[ZONE];
  const pity = GACHA.pity - since;

  useEffect(() => {
    if (!opening) return;
    const id = window.setTimeout(() => setOpening(false), OPEN_MS);
    return () => window.clearTimeout(id);
  }, [opening]);

  const pull = (n: PullSize): void => {
    // DECISIÓN: la semilla de las cajas no se guarda; las tiradas no son reproducibles a propósito.
    const g = act((d) => pullBoxes(d, ZONE, n, Math.random));
    if (!g) return;
    setRes({ grants: g, size: n });
    setOpening(!data.settings.reduceMotion);
    audio.play('chest');
  };

  const best = res ? bestOf(res.grants) : 'common';
  const fresh = res ? res.grants.filter((g) => g.isNew).length : 0;

  return (
    <Screen title={t('bunker.supplies.cmd')} onBack={onBack} nav={nav}>
      <section className="supply">
        <div className="supply__hero">
          <span className="supply__rays" aria-hidden="true" />
          <img className="supply__crate" src={pickupIcon('crate')} alt="" />
          <span className="supply__zone">{t('supplies.zone', { zone: t('zones.paramo') })}</span>
        </div>

        <div className="supply__side">
          <h2 className="supply__title">{t('supplies.rates')}</h2>
          <ul className="supply__odds">
            {RARITIES_HERE.map((r) => (
              <li key={r} className="odds" style={rarityVar(RARITY_COLOR[r])}>
                <span className="odds__head">
                  <span className="odds__rarity">{t(`rarity.${r}`)}</span>
                  <span className="odds__rate">{(RATES[r] * 100).toLocaleString()} %</span>
                </span>
                <span className="odds__who">
                  {POOL.filter((id) => SURVIVORS[id].rarity === r).map((id) => (
                    <span key={id} className="odds__face" title={t(`entities.${id}`)}>
                      {headOf(id) && <img src={headOf(id)} alt="" />}
                      <small>{t(`entities.${id}`)}</small>
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>

          <div className="supply__pity">
            <span>{t('supplies.pity', { n: pity, rarity: t(`rarity.${topRarity(ZONE)}`) })}</span>
            <span className="supply__pitybar" style={rarityVar(RARITY_COLOR[topRarity(ZONE)])}>
              <span style={{ width: `${(since / GACHA.pity) * 100}%` }} />
            </span>
          </div>

          <div className="supply__buy">
            {PULL_SIZES.map((n) => (
              <button
                key={n}
                className={`buy buy--${n}`}
                disabled={data.profile.credits < GACHA.cost[n]}
                onClick={() => pull(n)}
              >
                <span className="buy__count">×{n}</span>
                <span className="buy__cost">
                  <img src={pickupIcon('coupon')} alt="" />
                  {GACHA.cost[n].toLocaleString()}
                </span>
              </button>
            ))}
          </div>
          <p className="supply__rules">
            <small>{t('supplies.rules')}</small>
          </p>
        </div>
      </section>

      {res && (
        <div
          className={`overlay overlay--dark supply-open is-${best}`}
          style={rarityVar(RARITY_COLOR[best])}
          role="dialog"
          aria-modal="true"
        >
          {opening ? (
            <div className="crate">
              <span className="crate__rays" aria-hidden="true" />
              <img className="crate__img" src={pickupIcon('crate')} alt="" />
              <span className="crate__flash" aria-hidden="true" />
              <button className="btn" onClick={() => setOpening(false)}>
                {t('supplies.skip')}
              </button>
            </div>
          ) : (
            <div className="crate__result">
              <ul className={`pulls pulls--${res.size}`}>
                {res.grants.map((g, i) => (
                  <PullCard key={i} g={g} delay={i * DEAL_MS[res.size]} />
                ))}
              </ul>
              {res.size > 1 && (
                <p className="crate__sum">
                  {t('supplies.summary', { n: res.grants.length, fresh, rarity: t(`rarity.${best}`) })}
                </p>
              )}
              <button className="btn btn--primary" autoFocus onClick={() => setRes(null)}>
                {t('supplies.close')}
              </button>
            </div>
          )}
        </div>
      )}
    </Screen>
  );
}
