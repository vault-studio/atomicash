// Pestaña Ficha del personaje: retrato, nivel, estrellas, arma inicial y bonos.
import { useTranslation } from 'react-i18next';
import { SURVIVOR_LEVEL, STARS } from '../../../config/meta';
import { SURVIVORS, type RosterId } from '../../../config/survivors';
import { setStarter, starCost, starUp } from '../../../meta/actions';
import { useSave, useSaveData } from '../../../store/save';
import { weaponIcon } from '../../icons';
import { BlockHead, Stars } from './common';
import { Bonuses, Gauge, LevelInfo, StarsInfo, StarterInfo } from './SheetInfo';

/**
 * Pestaña Ficha: cuatro bloques que llenan el hueco (2×2): nivel y estrellas con su cifra en grande y lo que dan,
 * pasiva y arma inicial con su icono grande.
 */
export function SheetTab({ id }: { id: RosterId }) {
  const { t } = useTranslation();
  const o = useSaveData((d) => d.survivors[id]);
  const act = useSave((s) => s.act);
  if (!o) return null;

  const cost = starCost(o);
  const maxLevel = o.level >= SURVIVOR_LEVEL.max;
  const nextXp = SURVIVOR_LEVEL.next(o.level);
  const starPct = (o.stars - 1) * STARS.pctPerStar;
  const starters = [SURVIVORS[id].weapon, ...o.learnedStarters];
  const starter = o.starter ?? SURVIVORS[id].weapon;

  return (
    <div className="sheet__cols">
      <section className="sheet__block">
        <BlockHead title={t('sheet.level')} info={<LevelInfo level={o.level} />} />
        <div className="sheet__row">
          <strong className="sheet__big">{o.level}</strong>
          <Bonuses
            rows={[
              ['bonusHp', (o.level - 1) * SURVIVOR_LEVEL.hpPerLevel],
              ['bonusDmg', (o.level - 1) * SURVIVOR_LEVEL.dmgPerLevel],
            ]}
          />
        </div>
        <Gauge
          label={
            maxLevel ? t('collection.maxLevel') : t('collection.xp', { xp: Math.floor(o.xp), next: nextXp })
          }
          value={o.xp}
          max={maxLevel ? 1 : nextXp}
          full={maxLevel}
        />
      </section>

      <section className="sheet__block">
        <BlockHead title={t('sheet.stars')} info={<StarsInfo stars={o.stars} />} />
        <div className="sheet__row">
          <span className="sheet__stars">
            <Stars n={o.stars} />
          </span>
          <Bonuses
            rows={[
              ['bonusHp', starPct],
              ['bonusDmg', starPct],
              ['bonusSpd', starPct],
            ]}
          />
        </div>
        <div className="sheet__row sheet__row--end">
          <Gauge
            label={cost === null ? t('collection.maxStars') : t('collection.shards', { n: o.shards, cost })}
            value={o.shards}
            max={cost ?? 1}
            full={cost === null}
          />
          <button
            className="btn sheet__btn"
            disabled={cost === null || o.shards < cost}
            onClick={() => act((d) => starUp(d, id))}
          >
            ★ {t('collection.starUp')}
          </button>
        </div>
      </section>

      <section className="sheet__block">
        <BlockHead title={t('sheet.passive')} />
        <p className="sheet__passive">{t(`passives.${id}`)}</p>
      </section>

      <section className="sheet__block">
        <BlockHead title={t('collection.starter')} info={<StarterInfo weapon={starter} />} />
        <div className="sheet__center">
          <img className="sheet__wicon" src={weaponIcon(starter)} alt="" />
          <div className="sheet__weapon">
            <strong>{t(`weapons.${starter}.name`)}</strong>
            {starters.length > 1 && (
              <select
                value={starter}
                aria-label={t('collection.starter')}
                onChange={(e) => act((d) => setStarter(d, id, e.target.value as (typeof starters)[number]))}
              >
                {starters.map((w) => (
                  <option key={w} value={w}>
                    {t(`weapons.${w}.name`)}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
