// Cajas de suministros (02_GAMEPLAY.md §9): solo con créditos, probabilidades siempre visibles y garantía.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GACHA, PULL_SIZES, RARITIES, type PullSize } from '../../../config/meta';
import { SURVIVORS, type StatSurvivorId } from '../../../config/survivors';
import { audio } from '../../../audio/audio';
import { pullBoxes, type Grant } from '../../../meta/actions';
import { useSave } from '../../../store/save';
import { RARITY_COLOR, Screen } from './common';

const ZONE = 'paramo' as const;
const OPEN_MS = 900;

export function Supplies({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const data = useSave((s) => s.data);
  const act = useSave((s) => s.act);
  const [res, setRes] = useState<Grant[] | null>(null);
  const [opening, setOpening] = useState(false);
  const pity = GACHA.pity - data.gacha.pity[ZONE];

  useEffect(() => {
    if (!opening) return;
    const id = window.setTimeout(() => setOpening(false), OPEN_MS);
    return () => window.clearTimeout(id);
  }, [opening]);

  const pull = (n: PullSize): void => {
    // DECISIÓN: la semilla de las cajas no se guarda; las tiradas no son reproducibles a propósito.
    const g = act((d) => pullBoxes(d, ZONE, n, Math.random));
    if (!g) return;
    setRes(g);
    setOpening(!data.settings.reduceMotion);
    audio.play('chest');
  };

  return (
    <Screen title={t('bunker.supplies.cmd')} onBack={onBack}>
      <p>{t('supplies.zone', { zone: t('zones.paramo') })}</p>
      <table className="rates">
        <caption>{t('supplies.rates')}</caption>
        <tbody>
          {RARITIES.map((r) => (
            <tr key={r}>
              <th style={{ color: RARITY_COLOR[r] }}>{t(`rarity.${r}`)}</th>
              <td>{(GACHA.rates[r] * 100).toLocaleString()} %</td>
              <td>
                {(GACHA.pool[ZONE] as readonly StatSurvivorId[])
                  .filter((id) => SURVIVORS[id].rarity === r)
                  .map((id) => t(`entities.${id}`))
                  .join(', ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>{t('supplies.pity', { n: pity })}</p>
      <p>
        <small>{t('supplies.rules')}</small>
      </p>
      <div className="row">
        {PULL_SIZES.map((n) => (
          <button
            key={n}
            className="btn btn--primary"
            disabled={data.profile.credits < GACHA.cost[n]}
            onClick={() => pull(n)}
          >
            {t('supplies.pull', { n, cost: GACHA.cost[n] })}
          </button>
        ))}
      </div>

      {res && (
        <div className="overlay overlay--dark" role="dialog" aria-modal="true">
          {opening ? (
            <div className="crate">
              <div className="crate__box" aria-hidden="true" />
              <button className="btn" onClick={() => setOpening(false)}>
                {t('supplies.skip')}
              </button>
            </div>
          ) : (
            <div className="crate__result">
              <ul className={res.length > 1 ? 'pulls pulls--grid' : 'pulls'}>
                {res.map((g, i) => (
                  <li
                    key={i}
                    className={g.irradiated ? 'pull is-irradiated' : 'pull'}
                    style={{ borderColor: RARITY_COLOR[g.rarity] }}
                  >
                    <strong>{t(`entities.${g.id}`)}</strong>
                    <small>
                      {g.isNew ? t('supplies.new') : t('supplies.dup', { n: g.shards })}
                      {g.irradiated && <> · {t('collection.irradiated')}</>}
                    </small>
                  </li>
                ))}
              </ul>
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
