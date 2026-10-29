// Colección de supervivientes (02_GAMEPLAY.md §9): retrato grande, nivel, estrellas por fichas, irradiados y arma
// inicial.
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { GACHA, SURVIVOR_LEVEL } from '../../../config/meta';
import { SURVIVORS, type StatSurvivorId } from '../../../config/survivors';
import { setActive, setStarter, starCost, starUp } from '../../../meta/actions';
import type { OwnedSurvivor } from '../../../meta/save';
import { useSave } from '../../../store/save';
import { weaponIcon } from '../../icons';
import { RARITY_COLOR, Screen, Stars } from './common';
import { portraitOf } from './Portraits';

const POOL = GACHA.pool.paramo as readonly StatSurvivorId[];

/** Barra de progreso con su etiqueta encima. */
function Gauge({ label, value, max, full }: { label: string; value: number; max: number; full?: boolean }) {
  return (
    <div className={full ? 'gauge is-full' : 'gauge'}>
      <span className="gauge__label">{label}</span>
      <span className="gauge__bar">
        <span style={{ width: `${full ? 100 : Math.min(100, (value / max) * 100)}%` }} />
      </span>
    </div>
  );
}

interface CardProps {
  id: StatSurvivorId;
  owned?: OwnedSurvivor;
  active: boolean;
}

function RosterCard({ id, owned: o, active }: CardProps) {
  const { t } = useTranslation();
  const act = useSave((s) => s.act);
  const rarity = SURVIVORS[id].rarity;
  const cost = o ? starCost(o) : null;
  const starters = [SURVIVORS[id].weapon, ...(o?.learnedStarters ?? [])];
  const starter = o?.starter ?? SURVIVORS[id].weapon;
  const maxLevel = o ? o.level >= SURVIVOR_LEVEL.max : false;
  const cls = ['roster__card', active && 'is-active', o?.irradiated && 'is-irradiated', !o && 'is-locked']
    .filter(Boolean)
    .join(' ');

  return (
    <article className={cls} style={{ '--rarity': RARITY_COLOR[rarity] } as CSSProperties}>
      <div className="roster__art">
        <img className="roster__img" src={portraitOf(id)} alt="" />
        <span className="roster__rarity">{t(`rarity.${rarity}`)}</span>
        {active && <span className="roster__stamp">{t('collection.isActive')}</span>}
        {o?.irradiated && <span className="roster__irr">☢ {t('collection.irradiated')}</span>}
        <div className="roster__plate">
          <strong className="roster__name">{o ? t(`entities.${id}`) : t('collection.unknown')}</strong>
          {o && (
            <span className="roster__meta">
              <Stars n={o.stars} />
              <span className="roster__level">{t('collection.level', { n: o.level })}</span>
            </span>
          )}
        </div>
      </div>

      <div className="roster__body">
        {o ? (
          <>
            <p className="roster__passive">{t(`passives.${id}`)}</p>
            <Gauge
              label={
                maxLevel
                  ? t('collection.maxLevel')
                  : t('collection.xp', { xp: Math.floor(o.xp), next: SURVIVOR_LEVEL.next(o.level) })
              }
              value={o.xp}
              max={maxLevel ? 1 : SURVIVOR_LEVEL.next(o.level)}
              full={maxLevel}
            />
            <Gauge
              label={cost === null ? t('collection.maxStars') : t('collection.shards', { n: o.shards, cost })}
              value={o.shards}
              max={cost ?? 1}
              full={cost === null}
            />
            <label className="roster__starter">
              <img className="wicon" src={weaponIcon(starter)} alt="" />
              <span>{t('collection.starter')}</span>
              <select
                value={starter}
                onChange={(e) => act((d) => setStarter(d, id, e.target.value as (typeof starters)[number]))}
              >
                {starters.map((w) => (
                  <option key={w} value={w}>
                    {t(`weapons.${w}.name`)}
                  </option>
                ))}
              </select>
            </label>
            <div className="roster__actions">
              <button
                className="btn btn--primary"
                disabled={active}
                onClick={() => act((d) => setActive(d, id))}
              >
                {t(active ? 'collection.isActive' : 'collection.setActive')}
              </button>
              <button
                className="btn"
                disabled={cost === null || o.shards < cost}
                onClick={() => act((d) => starUp(d, id))}
              >
                ★ {t('collection.starUp')}
              </button>
            </div>
          </>
        ) : (
          <p className="roster__passive">{t('collection.notRecruited')}</p>
        )}
      </div>
    </article>
  );
}

export function Survivors({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const data = useSave((s) => s.data);

  return (
    <Screen title={t('bunker.survivors.cmd')} onBack={onBack}>
      <p>{t('collection.count', { n: Object.keys(data.survivors).length, total: POOL.length })}</p>
      <ul className="roster">
        {POOL.map((id) => (
          <li key={id}>
            <RosterCard id={id} owned={data.survivors[id]} active={data.profile.active === id} />
          </li>
        ))}
      </ul>
    </Screen>
  );
}
