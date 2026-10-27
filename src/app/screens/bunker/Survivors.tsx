// Colección de supervivientes (02_GAMEPLAY.md §9): nivel, estrellas por fichas, irradiados y arma inicial.
import { useTranslation } from 'react-i18next';
import { GACHA, SURVIVOR_LEVEL } from '../../../config/meta';
import { SURVIVORS, type StatSurvivorId } from '../../../config/survivors';
import { setActive, setStarter, starCost, starUp } from '../../../meta/actions';
import { useSave } from '../../../store/save';
import { Screen, SurvivorCard } from './common';

const POOL = GACHA.pool.paramo as readonly StatSurvivorId[];

export function Survivors({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const data = useSave((s) => s.data);
  const act = useSave((s) => s.act);

  return (
    <Screen title={t('bunker.survivors.cmd')} onBack={onBack}>
      <p>{t('collection.count', { n: Object.keys(data.survivors).length, total: POOL.length })}</p>
      <ul className="cards cards--wide">
        {POOL.map((id) => {
          const o = data.survivors[id];
          const active = data.profile.active === id;
          const cost = o ? starCost(o) : null;
          const starters = [SURVIVORS[id].weapon, ...(o?.learnedStarters ?? [])];
          return (
            <li key={id}>
              <SurvivorCard id={id} owned={o} active={active}>
                {o ? (
                  <>
                    <small>{t(`passives.${id}`)}</small>
                    <small>
                      {o.level < SURVIVOR_LEVEL.max
                        ? t('collection.xp', { xp: Math.floor(o.xp), next: SURVIVOR_LEVEL.next(o.level) })
                        : t('collection.maxLevel')}
                    </small>
                    <small>
                      {cost === null
                        ? t('collection.maxStars')
                        : t('collection.shards', { n: o.shards, cost })}
                    </small>
                    <label className="field">
                      <span>{t('collection.starter')}</span>
                      <select
                        value={o.starter ?? SURVIVORS[id].weapon}
                        onChange={(e) =>
                          act((d) => setStarter(d, id, e.target.value as (typeof starters)[number]))
                        }
                      >
                        {starters.map((w) => (
                          <option key={w} value={w}>
                            {t(`weapons.${w}.name`)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="row">
                      <button className="btn" disabled={active} onClick={() => act((d) => setActive(d, id))}>
                        {t(active ? 'collection.isActive' : 'collection.setActive')}
                      </button>
                      <button
                        className="btn"
                        disabled={cost === null || o.shards < cost}
                        onClick={() => act((d) => starUp(d, id))}
                      >
                        {t('collection.starUp')}
                      </button>
                    </div>
                  </>
                ) : (
                  <small>{t('collection.notRecruited')}</small>
                )}
              </SurvivorCard>
            </li>
          );
        })}
      </ul>
    </Screen>
  );
}
